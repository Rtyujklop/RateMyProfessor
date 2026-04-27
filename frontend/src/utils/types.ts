export type Professor = {
	professorId: string;
	name: string;
	department: string;
	rmpRating: number;
	sentimentScore?: number;
};

export type GetProfessorsResponse = {
	schoolId: string;
	professors: Professor[];
};

export type GetCourseProfessorsResponse = {
	schoolId: string;
	professors: Array<
		Professor & {
			sentimentScore: number;
		}
	>;
};

export type AnalysisResponse = {
	professorId: string;
	name: string;
	rmpRating: number;
	sentimentScore: number;
};

export type AnalysisHistoryEntry = {
	rmpRating: number;
	sentimentScore: number;
	createdAt: string;
};

export type ProfessorHistoryResponse = {
	professorId: string;
	name: string;
	history: AnalysisHistoryEntry[];
};
