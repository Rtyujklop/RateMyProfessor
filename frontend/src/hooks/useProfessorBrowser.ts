import { useEffect, useMemo, useState } from "react";

import { analyzeProfessor, getProfessorsForSchool } from "../utils/api";
import { SCHOOL_NAME_TO_ID, SCHOOL_OPTIONS } from "../utils/mockSchools";
import type { AnalysisResponse, Professor } from "../utils/types";

const ALL_DEPARTMENTS = "all";

function normalize(text: string): string {
	return text.trim().toLowerCase();
}

export function useProfessorBrowser() {
	const [selectedSchoolName, setSelectedSchoolName] = useState("");
	const [professors, setProfessors] = useState<Professor[]>([]);
	const [isLoadingProfessors, setIsLoadingProfessors] = useState(false);
	const [professorsError, setProfessorsError] = useState("");

	const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS);
	const [nameQuery, setNameQuery] = useState("");
	const [selectedProfessorId, setSelectedProfessorId] = useState("");

	const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [analysisError, setAnalysisError] = useState("");

	const selectedSchoolId = selectedSchoolName
		? SCHOOL_NAME_TO_ID[selectedSchoolName]
		: "";

	useEffect(() => {
		if (!selectedSchoolId) {
			setProfessors([]);
			setProfessorsError("");
			setDepartmentFilter(ALL_DEPARTMENTS);
			setNameQuery("");
			setSelectedProfessorId("");
			setAnalysis(null);
			setAnalysisError("");
			setIsLoadingProfessors(false);
			return;
		}

		let isCancelled = false;

		async function loadProfessors() {
			setIsLoadingProfessors(true);
			setProfessorsError("");
			setAnalysis(null);
			setAnalysisError("");
			setSelectedProfessorId("");
			setDepartmentFilter(ALL_DEPARTMENTS);
			setNameQuery("");

			try {
				const response = await getProfessorsForSchool(selectedSchoolId);

				if (isCancelled) {
					return;
				}

				setProfessors(response.professors ?? []);
			} catch (error) {
				if (isCancelled) {
					return;
				}

				const message =
					error instanceof Error
						? error.message
						: "Could not load professors for this school.";
				setProfessorsError(message);
				setProfessors([]);
			} finally {
				if (!isCancelled) {
					setIsLoadingProfessors(false);
				}
			}
		}

		void loadProfessors();

		return () => {
			isCancelled = true;
		};
	}, [selectedSchoolId]);

	const departmentOptions = useMemo(() => {
		const values = new Set<string>();
		professors.forEach((professor) => values.add(professor.department));
		return [ALL_DEPARTMENTS, ...Array.from(values).sort()];
	}, [professors]);

	const filteredProfessors = useMemo(() => {
		const normalizedQuery = normalize(nameQuery);

		return professors.filter((professor) => {
			const departmentMatch =
				departmentFilter === ALL_DEPARTMENTS ||
				professor.department === departmentFilter;
			const nameMatch =
				normalizedQuery.length === 0 ||
				normalize(professor.name).includes(normalizedQuery);

			return departmentMatch && nameMatch;
		});
	}, [departmentFilter, nameQuery, professors]);

	const selectedProfessor = useMemo(() => {
		return (
			professors.find(
				(professor) => professor.professorId === selectedProfessorId,
			) ?? null
		);
	}, [professors, selectedProfessorId]);

	function handleSelectProfessor(professorId: string) {
		setSelectedProfessorId(professorId);
		setAnalysis(null);
		setAnalysisError("");
	}

	function clearAnalysis() {
		setAnalysis(null);
		setAnalysisError("");
	}

	function resetProfessorView() {
		setDepartmentFilter(ALL_DEPARTMENTS);
		setNameQuery("");
		setSelectedProfessorId("");
		setProfessorsError("");
		clearAnalysis();
	}

	async function handleAnalyzeSelectedProfessor() {
		if (!selectedProfessorId) {
			return null;
		}

		setIsAnalyzing(true);
		setAnalysisError("");
		setAnalysis(null);

		try {
			const result = await analyzeProfessor(selectedProfessorId);
			setAnalysis(result);
			return result;
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Could not analyze this professor.";
			setAnalysisError(message);
			return null;
		} finally {
			setIsAnalyzing(false);
		}
	}

	return {
		schoolOptions: SCHOOL_OPTIONS,
		selectedSchoolName,
		selectedSchoolId,
		professors,
		isLoadingProfessors,
		professorsError,
		departmentOptions,
		departmentFilter,
		nameQuery,
		filteredProfessors,
		selectedProfessorId,
		selectedProfessor,
		analysis,
		isAnalyzing,
		analysisError,
		setSelectedSchoolName,
		setDepartmentFilter,
		setNameQuery,
		handleSelectProfessor,
		clearAnalysis,
		resetProfessorView,
		handleAnalyzeSelectedProfessor,
	};
}
