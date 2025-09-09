import psycopg2
import json
from src.config import DATABASE_URL

def get_free_slots(user_id):
    # Connect and fetch free slots for user
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT day_of_week, start_time, end_time FROM study_slots WHERE user_id=%s AND is_free=true", (user_id,))
    slots = cur.fetchall()
    cur.close()
    conn.close()
    return slots

def save_study_plan(user_id, input_data, result, status, weeks_required, error_message=None):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO study_plans (user_id, input_data, result, status, weeks_required, error_message) VALUES (%s, %s, %s, %s, %s, %s)",
        (user_id, json.dumps(input_data), json.dumps(result), status, weeks_required, error_message)
    )
    conn.commit()
    cur.close()
    conn.close()