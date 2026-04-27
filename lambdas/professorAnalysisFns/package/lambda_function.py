import json
import boto3
import pymysql
import base64
import re
import time
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
import RateMyProfessor_Database_APIs
import RateMyProfessor_Database_APIs.helper_functions as helpers
import RateMyProfessor_Database_APIs.main as main
from RateMyProfessor_Database_APIs.helper_queries import fetch_a_professors_query_string
from RateMyProfessor_Database_APIs.helper_classes import parse_professor
from datetime import datetime
import requests

s3 = boto3.client('s3', region_name='us-east-2')
comprehend = boto3.client('comprehend', region_name='us-east-2')

DEBUG=False
ENV = os.getenv("ENV", "alex-dev")
S3_BUCKET = os.getenv("S3_BUCKET", f"{ENV}-ratemyprof-raw-ratings")
RDS_HOST = os.getenv("DB_HOST", "localhost")
RDS_PORT = int(os.getenv("DB_PORT", "3306"))
RDS_USER = os.getenv("DB_USER", "admin")
RDS_PASSWORD = os.getenv("DB_PASS", "")
RDS_DB = os.getenv("DB_NAME", "ratemyprof")
GRAPHQL_ENDPOINT = "https://www.ratemyprofessors.com/graphql"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Content-Type": "application/json",
    "Referer": "https://www.ratemyprofessors.com/"
}

# setup session with correct headers for RMP
session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0",
})

session.get("https://www.ratemyprofessors.com")

# monkey patch
helpers.requests = session
main.requests = session

def log_time(label, start_time):
    elapsed = time.time() - start_time
    print(f"[TIMER] {label}: {elapsed:.3f}s")

def get_db_connection():
    return pymysql.connect(
        host=RDS_HOST,
        port=RDS_PORT,
        user=RDS_USER,
        password=RDS_PASSWORD,
        database=RDS_DB,
        ssl={'ssl': True}
    )

def prof_to_graphql_id(legacy_id: int) -> str:  
    return base64.b64encode(f"Teacher-{legacy_id}".encode()).decode()

def school_to_graphql_id(legacy_id: int) -> str:  
    return base64.b64encode(f"School-{legacy_id}".encode()).decode()

def normalize_course_code(code: str) -> str:
    return re.sub(r'[\s\-]', '', code).lower()

def fetch_professor_by_id(id: int):
    graphql_id = prof_to_graphql_id(id)
    response = session.post(
        GRAPHQL_ENDPOINT,
        json={
            "query": fetch_a_professors_query_string,
            "variables": {"id": graphql_id}
        },
        headers=HEADERS
    )
    if response.status_code != 200:
        raise Exception(f"Failed: {response.status_code} {response.text}")
    return parse_professor(response.json())

def fetch_professor_data_by_course(school_id, target_course):
    # Reverse engineer a new GraphQL query from the API to fetch professors by course efficiently
    query = """
query TeacherSearch($count: Int!, $cursor: String, $query: TeacherSearchQuery!) {
  search: newSearch {
    teachers(query: $query, first: $count, after: $cursor) {
      edges {
        cursor
        node {
          id
          legacyId
          firstName
          lastName
          department
          avgRating
          numRatings
          courseCodes {
            courseName
            courseCount
          }
          school {
            legacyId
            name
          }
          ratings(first: 100) {
            edges {
              node {
                comment
                helpfulRating
                clarityRating
                difficultyRating
                class
                date
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
"""
    variables = {
        "count": 250,
        "cursor": None,
        "query": {
            "text": "",
            "schoolID": school_to_graphql_id(int(school_id)),
            "fallback": True,
            "departmentID": None
        }
    }

    filtered_profs = []
    cursor = None

    start_fetch = time.time()
    page_count = 0

    while True:
        page_start = time.time()

        variables["cursor"] = cursor

        response = session.post(
            GRAPHQL_ENDPOINT,
            json={
                "query": query,
                "variables": variables
            },
            headers=HEADERS
        ).json()

        if "data" not in response:
            raise Exception(response)

        data = response["data"]["search"]["teachers"]
        normalized_course = normalize_course_code(target_course)

        for e in data["edges"]:
            prof = e["node"]

            ratings = [
                r["node"]
                for r in prof.get("ratings", {}).get("edges", [])
            ]

            prof["ratings"] = ratings

            if any(
                normalized_course in normalize_course_code(c["courseName"])
                for c in prof.get("courseCodes", [])
            ):
                filtered_profs.append(prof)

        if not data["pageInfo"]["hasNextPage"]:
            break

        cursor = data["pageInfo"]["endCursor"]

        log_time(f"GraphQL page {page_count}", page_start)
        page_count += 1

    log_time("TOTAL GraphQL fetch", start_fetch)
    print(f"[DEBUG] Total professors fetched: {len(filtered_profs)}")

    return filtered_profs

def analyze_sentiment(ratings):
    texts = [
        r["comment"]
        for r in ratings
        if r["comment"] and r["comment"].strip().lower() != "no comments"
    ]

    if not texts:
        return {
            "statusCode": 422,
            "body": json.dumps({"error": "No reviewable comments found to analyze"})
        }

    chunks = [texts[i:i+25] for i in range(0, len(texts), 25)]

    sentiment_scores = []
    for chunk in chunks:
        res = comprehend.batch_detect_sentiment(
            TextList=chunk,
            LanguageCode='en'
        )

        for s in res["ResultList"]:
            score = s["SentimentScore"]
            sentiment_scores.append(score["Positive"] - score["Negative"])

    raw_avg = sum(sentiment_scores) / len(sentiment_scores)
    return round(((raw_avg + 1) / 2) * 5, 2)

def process_ratings(professor_id, professor):
    ratings = professor.ratings if hasattr(professor, "ratings") else professor.get("ratings", [])
    school = professor.school if hasattr(professor, "school") else professor.get("school", {})
    first_name = professor.first_name if hasattr(professor, "first_name") else professor.get("firstName")
    last_name = professor.last_name if hasattr(professor, "last_name") else professor.get("lastName")
    avg_rating = professor.avg_rating if hasattr(professor, "avg_rating") else professor.get("avgRating")
    department = professor.department if hasattr(professor, "department") else professor.get("department")
    num_ratings = professor.num_ratings if hasattr(professor, "num_ratings") else professor.get("numRatings")
    school_id = school.get('legacy_id') or school.get('legacyId')
    school_name = school.get('name')

    if not ratings:
        return None

    if not school_id:
        return None

    sentiment_score = analyze_sentiment(ratings)

    return {
        "professor_id": int(professor_id),
        "school_id": school_id,
        "school_name": school_name,
        "name": f"{first_name} {last_name}",
        "department": department,
        "num_ratings": num_ratings,
        "avg_rating": avg_rating,
        "sentiment_score": sentiment_score,
        "ratings": ratings
    }

def batch_persist_results(results):
    if DEBUG or not results:
        return

    # ---------- S3 (batch) ----------
    s3_time = time.time()

    s3_payload = [
        {
            "professorId": r["professor_id"],
            "schoolId": r["school_id"],
            "name": r["name"],
            "rmpRating": r["avg_rating"],
            "ratings": r["ratings"]
        }
        for r in results
    ]

    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f"batch/{datetime.utcnow().strftime('%Y%m%dT%H%M%S')}.json",
        Body=json.dumps(s3_payload),
        ContentType='application/json'
    )

    log_time("S3 batch upload", s3_time)

    # ---------- RDS (batch) ----------
    rds_time = time.time()

    conn = get_db_connection()
    with conn.cursor() as cursor:
        # schools
        cursor.executemany("""
            INSERT INTO schools (school_id, name)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE name = VALUES(name)
        """, [
            (r["school_id"], r["school_name"])
            for r in results
        ])

        # professors
        cursor.executemany("""
            INSERT INTO professors (prof_id, name, school_id, department, num_ratings)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                school_id = VALUES(school_id),
                department = VALUES(department),
                num_ratings = VALUES(num_ratings)
        """, [
            (
                r["professor_id"],
                r["name"],
                r["school_id"],
                r["department"],
                r["num_ratings"]
            )
            for r in results
        ])

        # analysis_runs
        cursor.executemany("""
            INSERT INTO analysis_runs (professor_id, sentiment_score, rmp_rating)
            VALUES (%s, %s, %s)
        """, [
            (r["professor_id"], r["sentiment_score"], r["avg_rating"])
            for r in results
        ])

    conn.commit()
    conn.close()

    log_time("RDS batch upload", rds_time)

def get_professors_by_course(event):
    start_total = time.time()

    school_id = event.get('pathParameters', {}).get('schoolId')
    course_code = event.get('pathParameters', {}).get('courseCode')
    if not school_id or not course_code:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing schoolId or courseCode"})
        }

    match_time = time.time()

    matching_professors = fetch_professor_data_by_course(school_id, course_code)

    log_time("Fetch and filter professors", match_time)

    if not matching_professors:
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "schoolId": school_id,
                "professors": []
            })
        }

    batch_results = []
    api_results = []

    processing_start = time.time()
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(process_ratings, p["legacyId"], p) for p in matching_professors]
        for f in as_completed(futures):
            r = f.result()
            if not r:
                continue

            batch_results.append(r)

            api_results.append({
                "professorId": str(r["professor_id"]),
                "name": r["name"],
                "department": r["department"],
                "rmpRating": r["avg_rating"],
                "sentimentScore": r["sentiment_score"]
            })
    
    log_time("Total sentiment analysis", processing_start)

    batch_persist_results(batch_results)

    api_results.sort(key=lambda x: x["sentimentScore"], reverse=True)

    log_time("TOTAL REQUEST", start_total)

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "schoolId": school_id,
            "professors": api_results
        })
    }

def post_analyze_professor(event):
    professor_id = event.get('pathParameters', {}).get('professorId')
    if not professor_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing professorId"})
        }
    try:
        professor = fetch_professor_by_id(int(professor_id))
    except Exception as e:
        return {
            "statusCode": 502,
            "body": json.dumps({"error": f"Failed to fetch professor: {str(e)}"})
        }
    
    result = process_ratings(professor_id, professor)
    
    batch_persist_results([result])

    return {
        "statusCode": 201,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "professorId": professor_id,
            "name": result["name"],
            "rmpRating": result["avg_rating"],
            "sentimentScore": result["sentiment_score"]
        })
    }

def lambda_handler(event, context):
    path_parameters = event.get('pathParameters', {})
    method = event.get("requestContext", {}).get("http", {}).get("method", "")

    if method == "POST" and "professorId" in path_parameters:
        if int(path_parameters.get("professorId")) == 1185289:
            raise Exception("Don Reynolds Error")

        return post_analyze_professor(event)
    elif method == "GET" and "courseCode" in path_parameters:
        return get_professors_by_course(event)
    else:
        return {
            "statusCode": 404,
            "body": json.dumps({"error": "Endpoint not found"})
        }
