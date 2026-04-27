import json
import pymysql
import os

RDS_HOST = os.getenv("DB_HOST", "localhost")
RDS_PORT = int(os.getenv("DB_PORT", "3306"))
RDS_USER = os.getenv("DB_USER", "admin")
RDS_PASSWORD = os.getenv("DB_PASS", "")
RDS_DB = os.getenv("DB_NAME", "ratemyprof")

def get_db_connection():
    return pymysql.connect(
        host=RDS_HOST,
        port=RDS_PORT,
        user=RDS_USER,
        password=RDS_PASSWORD,
        database=RDS_DB,
        ssl={'ssl': True}
    )

def get_professor_history(event):
    professor_id = event.get('pathParameters', {}).get('professorId')
    if not professor_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing professorId"})
        }
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT name FROM professors WHERE prof_id = %s
            """, (int(professor_id),))
            prof_row = cursor.fetchone()
            if not prof_row:
                return {
                    "statusCode": 404,
                    "body": json.dumps({"error": "Professor not found"})
                }
            professor_name = prof_row[0]
            cursor.execute("""
                SELECT rmp_rating, sentiment_score, created_at
                FROM analysis_runs
                WHERE professor_id = %s
                ORDER BY created_at DESC
            """, (int(professor_id),))
            rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        return {
            "statusCode": 502,
            "body": json.dumps({"error": f"Failed to query database: {str(e)}"})
        }
    history = [
        {
            "rmpRating": row[0],
            "sentimentScore": row[1],
            "createdAt": row[2].isoformat() if hasattr(row[2], 'isoformat') else str(row[2])
        }
        for row in rows
    ]
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "professorId": professor_id,
            "name": professor_name,
            "history": history
        })
    }

def lambda_handler(event, context):
    return get_professor_history(event)
