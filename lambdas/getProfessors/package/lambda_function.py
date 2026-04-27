import json
import requests
import RateMyProfessor_Database_APIs
import RateMyProfessor_Database_APIs.helper_functions as helpers
import RateMyProfessor_Database_APIs.main as main

# setup session with correct headers for RMP
session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0",
})

session.get("https://www.ratemyprofessors.com")

# monkey patch
helpers.requests = session
main.requests = session

def lambda_handler(event, context):
    school_id = event.get('pathParameters', {}).get('schoolId')
    if not school_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing schoolId"})
        }

    try:
        raw_professors = RateMyProfessor_Database_APIs.fetch_all_professors_from_a_school(school_id)
    except Exception as e:
        return {
            "statusCode": 502,
            "body": json.dumps({"error": f"Failed to fetch professors: {str(e)}"})
        }
    professors = [
        {
            "professorId": str(prof.legacy_id),
            "name": f"{prof.first_name} {prof.last_name}",
            "department": prof.department,
            "rmpRating": prof.avg_rating
        }
        for prof in raw_professors
    ]
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "schoolId": school_id,
            "professors": professors
        })
    }
