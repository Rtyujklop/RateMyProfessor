# RateMyProfessor Sentiment Analyzer

**Team:** Alex Hetrick, Muhammad Yousaf Iqbal, Caleb Alemu, Devin Rhodie

## Overview

This application analyzes professor reviews from RateMyProfessor and generates a sentiment-based score to help users better evaluate professors.

The system fetches professor data from RateMyProfessor, performs sentiment analysis using AWS Comprehend, stores results in RDS, and exposes endpoints via API Gateway backed by Lambda functions.

## AWS Services

All services are hosted in region **`us-east-2`**

- **API Gateway** – routes HTTP requests
- **Lambda** – backend compute
- **RDS (MySQL)** – stores analysis results
- **S3** – stores raw review data
- **Comprehend** – sentiment analysis
- **CloudWatch** – logging and monitoring
- **SNS** – error notifications
- **Terraform** – infrastructure as code

## Deployment

Terraform will provision all AWS resources including API Gateway, Lambda, RDS, S3, CloudWatch, and SNS.

1. If you made code changes to the lambda, package them into zip files
   a. `cd lambdas`
   b. `./build.sh`
   c. If you don't have permission to run it, `chmod +x build.sh`
2. Run terraform
   a. `terraform plan`
   b. `terraform apply`

## DB Workflow

The database bootstrap now uses:

- `db/schema.sql` for schema creation
- `db/db_seed.sql` for data-only seed rows

Terraform applies schema first and then seed data.

To regenerate `db/db_seed.sql` from the current RDS data:

1. From the repo root, run:
   ./db/create_dump.sh --host <your-rds-endpoint>
2. Enter the DB password when prompted (or set MYSQL_PWD).
3. Commit the updated `db/db_seed.sql` if you want teammates and rebuilds to get the same data.

Notes:

- The dump script intentionally creates a data-only seed (no DROP TABLE or CREATE TABLE statements).
- Keep schema changes in `db/schema.sql`, not in `db/db_seed.sql`.

## API Contract

### GET Professors

`GET /schools/{schoolId}/professors`

Retrieves a list of professors for a given school using the RateMyProfessor API.

#### Response

```json
{
  "schoolId": string,
  "professors": [
    {
      "professorId": string,
      "name": string,
      "department": string,
      "rmpRating": number
    }
  ]
}
```

### GET Professors by Course

`GET /schools/{schoolId}/courses/{courseCode}/professors`

Returns a list of professors for a course ranked by sentiment. For each professor found, this function will also analyze their ratings and store their results.

#### Response

```json
{
  "schoolId": string,
  "professors": [
    {
      "professorId": string,
      "name": string,
      "department": string,
      "rmpRating": number,
      "sentimentScore": number
    }
  ]
}
```

### GET Professor Analysis History

`GET /professors/{professorId}/history`

Returns a list of all analysis runs that have been performed for a professor over time.

#### Response

```json
{
  "professorId": string,
  "name": string,
  "history": [
    {
      "rmpRating": number,
      "sentimentScore": number,
      "createdAt": string // ISO 8601 format
    }
  ]
}
```

### POST Analyze Professor

`POST /professors/{professorId}/analyze`

Analyzes reviews for a selected professor and returns a sentiment-based evaluation.

#### Response

```json
{
  "professorId": string,
  "name": string,
  "rmpRating": number,
  "sentimentScore": number
}
```

## DB Schema

### Table: `professors`

All professors that have been analyzed

_Note: Professors in this table should be unique. Any subsequent analyses should only update `analysis_runs`_

| Column      | Type         | Notes                                             |
| ----------- | ------------ | ------------------------------------------------- |
| rmp_prof_id | INT          | Primary key, id from RateMyProfessor API          |
| name        | VARCHAR(100) |                                                   |
| school_id   | INT          | Foreign key to schools `id` (not `rmp_school_id`) |
| department  | VARCHAR(255) |                                                   |
| num_ratings | INT          |                                                   |

### Table: `analysis_runs`

A history of all analyses the user has done

| Column          | Type         | Notes                                              |
| --------------- | ------------ | -------------------------------------------------- |
| id              | INT          | Primary key                                        |
| professor_id    | VARCHAR(100) | Foreign key to professors `id` (not `rmp_prof_id`) |
| sentiment_score | FLOAT        |                                                    |
| rmp_rating      | FLOAT        | Rating from RateMyProfessor API                    |
| created_at      | TIMESTAMP    | Auto-generated                                     |

### Table: `schools`

School information, in case we use it at some point

| Column        | Type         | Notes          |
| ------------- | ------------ | -------------- |
| rmp_school_id | INT          | Primary key    |
| name          | VARCHAR(100) |                |
| created_at    | TIMESTAMP    | Auto-generated |

### Connecting to RDS DB locally

We are using MySQL for the database. The RDS username is `admin`, and the password is `swen514team5`

1. Make sure MySQL is installed
2. In RDS, click on the `ratemyprof-db` database
3. Follow the connection steps listed under "Connectivity & security"
4. Enter password
5. Once in the MySQL console, run `USE ratemyprof;` to enter the database
6. Verify by running `SHOW TABLES;`
