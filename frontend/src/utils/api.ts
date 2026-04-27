import type {
	AnalysisResponse,
	GetCourseProfessorsResponse,
	GetProfessorsResponse,
	ProfessorHistoryResponse,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_GATEWAY_URL;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${BASE_URL}${path}`, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...init?.headers,
		},
	});

	if (!response.ok) {
		const responseText = await response.text();
		const message =
			responseText || `Request failed with status ${response.status}`;
		throw new Error(message);
	}

	return (await response.json()) as T;
}

export function getProfessorsForSchool(
	schoolId: string,
): Promise<GetProfessorsResponse> {
	return requestJson<GetProfessorsResponse>(`/schools/${schoolId}/professors`);
}

export function getProfessorsForCourse(
	schoolId: string,
	courseCode: string,
): Promise<GetCourseProfessorsResponse> {
	const encodedCourseCode = encodeURIComponent(courseCode.trim());
	return requestJson<GetCourseProfessorsResponse>(
		`/schools/${schoolId}/courses/${encodedCourseCode}/professors`,
	);
}

export function analyzeProfessor(
	professorId: string,
): Promise<AnalysisResponse> {
	return requestJson<AnalysisResponse>(`/professors/${professorId}/analyze`, {
		method: "POST",
	});
}

export function getProfessorHistory(
	professorId: string,
): Promise<ProfessorHistoryResponse> {
	return requestJson<ProfessorHistoryResponse>(
		`/professors/${professorId}/history`,
	);
}
