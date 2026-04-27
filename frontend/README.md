# Professor Sentiment Comparator

This frontend is a simple prototype that helps students compare professors for a specific course using RateMyProfessor-style review data and sentiment scoring.

## User flow

1. Enter a school ID.
2. Select a department.
3. Select a course in that department.
4. Compare professors teaching that course by:
   - Sentiment score
   - Star rating
   - Difficulty rating
   - Course-specific student summary

## Sentiment analysis behavior

- By default, the app uses a local Comprehend-like sentiment simulator so the demo runs without backend setup.
- If you provide a backend endpoint, the app will call that endpoint for real sentiment analysis.

### Optional environment variable

Create a `.env` file in this folder and set:

```bash
VITE_COMPREHEND_API_URL=https://your-api.example.com/analyze
```

Expected API response shape:

```json
{
	"sentiment": "POSITIVE",
	"scores": {
		"positive": 0.91,
		"negative": 0.03,
		"neutral": 0.04,
		"mixed": 0.02
	}
}
```

## Run locally

```bash
npm install
npm run dev
```
