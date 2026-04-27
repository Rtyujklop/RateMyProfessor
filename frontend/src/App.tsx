import { useMemo, useRef, useState } from "react";

import { CourseSearchForm } from "./components/CourseSearchForm";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { ProfessorGrid } from "./components/ProfessorGrid";
import {
	SearchModeToggle,
	type SearchMode,
} from "./components/SearchModeToggle";
import { useProfessorBrowser } from "./hooks/useProfessorBrowser";
import { getProfessorsForCourse } from "./utils/api";
import type { AnalysisResponse, Professor } from "./utils/types";

const PAGE_SIZE = 100;
const DOCK_EXIT_DURATION_MS = 280;

type BottomPanelMode = "dock" | "dock-exit" | "loading" | "result";

function App() {
	const [searchMode, setSearchMode] = useState<SearchMode>("professors");
	const browser = useProfessorBrowser();
	const [professorPage, setProfessorPage] = useState(1);
	const [coursePage, setCoursePage] = useState(1);
	const [bottomPanelMode, setBottomPanelMode] =
		useState<BottomPanelMode>("dock");
	const [courseCode, setCourseCode] = useState("");
	const [courseProfessors, setCourseProfessors] = useState<Professor[]>([]);
	const [selectedCourseProfessorId, setSelectedCourseProfessorId] =
		useState("");
	const [isLoadingCourseProfessors, setIsLoadingCourseProfessors] =
		useState(false);
	const [courseProfessorsError, setCourseProfessorsError] = useState("");
	const courseSearchRequestIdRef = useRef(0);

	const activeProfessors = useMemo(() => {
		return searchMode === "professors"
			? browser.filteredProfessors
			: courseProfessors;
	}, [browser.filteredProfessors, courseProfessors, searchMode]);

	const currentPage = searchMode === "professors" ? professorPage : coursePage;
	const coursePanelKey = `${selectedCourseProfessorId || "none"}:${
		isLoadingCourseProfessors ? "loading" : "idle"
	}:${courseProfessorsError ? "error" : "ok"}:${courseProfessors.length}`;
	const professorResultKey = `${browser.analysis?.professorId || "none"}:${
		browser.analysisError ? "error" : "ok"
	}`;

	const selectedCourseProfessor = useMemo(() => {
		return (
			courseProfessors.find(
				(professor) => professor.professorId === selectedCourseProfessorId,
			) ?? null
		);
	}, [courseProfessors, selectedCourseProfessorId]);

	const selectedCourseAnalysis = useMemo<AnalysisResponse | null>(() => {
		if (!selectedCourseProfessor) {
			return null;
		}

		if (typeof selectedCourseProfessor.sentimentScore !== "number") {
			return null;
		}

		return {
			professorId: selectedCourseProfessor.professorId,
			name: selectedCourseProfessor.name,
			rmpRating: selectedCourseProfessor.rmpRating,
			sentimentScore: selectedCourseProfessor.sentimentScore,
		};
	}, [selectedCourseProfessor]);

	const totalPages = useMemo(() => {
		return Math.max(1, Math.ceil(activeProfessors.length / PAGE_SIZE));
	}, [activeProfessors.length]);

	const paginatedProfessors = useMemo(() => {
		const startIndex = (currentPage - 1) * PAGE_SIZE;
		const endIndex = startIndex + PAGE_SIZE;
		return activeProfessors.slice(startIndex, endIndex);
	}, [activeProfessors, currentPage]);

	const firstShown = activeProfessors.length
		? (currentPage - 1) * PAGE_SIZE + 1
		: 0;
	const lastShown = activeProfessors.length
		? Math.min(currentPage * PAGE_SIZE, activeProfessors.length)
		: 0;

	const activeListError =
		searchMode === "professors"
			? browser.professorsError
			: courseProfessorsError;
	const isActiveListLoading =
		searchMode === "professors"
			? browser.isLoadingProfessors
			: isLoadingCourseProfessors;

	const selectedProfessorId =
		searchMode === "professors"
			? browser.selectedProfessorId
			: selectedCourseProfessorId;

	function resetCourseSearch() {
		courseSearchRequestIdRef.current += 1;
		setCourseCode("");
		setCourseProfessors([]);
		setSelectedCourseProfessorId("");
		setCourseProfessorsError("");
		setIsLoadingCourseProfessors(false);
	}

	const handleSchoolChange = (schoolName: string) => {
		setProfessorPage(1);
		setCoursePage(1);
		setBottomPanelMode("dock");
		browser.clearAnalysis();
		browser.resetProfessorView();
		resetCourseSearch();
		browser.setSelectedSchoolName(schoolName);
	};

	const handleSearchModeChange = (mode: SearchMode) => {
		setSearchMode(mode);
		if (mode === "professors") {
			setBottomPanelMode("dock");
		}
	};

	const handleDepartmentChange = (department: string) => {
		setProfessorPage(1);
		setBottomPanelMode("dock");
		browser.clearAnalysis();
		browser.setDepartmentFilter(department);
	};

	const handleNameQueryChange = (query: string) => {
		setProfessorPage(1);
		setBottomPanelMode("dock");
		browser.clearAnalysis();
		browser.setNameQuery(query);
	};

	const handleProfessorSelect = (professorId: string) => {
		if (searchMode === "professors") {
			setBottomPanelMode("dock");
			browser.handleSelectProfessor(professorId);
			return;
		}

		setSelectedCourseProfessorId(professorId);
	};

	const handleCourseSubmit = async () => {
		if (!browser.selectedSchoolId || isLoadingCourseProfessors) {
			return;
		}

		const normalizedCourseCode = courseCode.trim();
		if (!normalizedCourseCode) {
			return;
		}

		setCoursePage(1);
		setCourseProfessorsError("");
		setSelectedCourseProfessorId("");
		setIsLoadingCourseProfessors(true);
		const requestId = courseSearchRequestIdRef.current + 1;
		courseSearchRequestIdRef.current = requestId;

		try {
			const response = await getProfessorsForCourse(
				browser.selectedSchoolId,
				normalizedCourseCode,
			);

			if (requestId !== courseSearchRequestIdRef.current) {
				return;
			}

			const rankedProfessors = [...(response.professors ?? [])].sort(
				(left, right) => {
					const sentimentDelta = right.sentimentScore - left.sentimentScore;
					if (sentimentDelta !== 0) {
						return sentimentDelta;
					}

					return right.rmpRating - left.rmpRating;
				},
			);

			setCourseProfessors(rankedProfessors);
		} catch (error) {
			if (requestId !== courseSearchRequestIdRef.current) {
				return;
			}

			const message =
				error instanceof Error
					? error.message
					: "Could not load professors for that course.";
			setCourseProfessorsError(message);
			setCourseProfessors([]);
		} finally {
			if (requestId === courseSearchRequestIdRef.current) {
				setIsLoadingCourseProfessors(false);
			}
		}
	};

	const handleAnalyzeClick = async () => {
		if (
			searchMode !== "professors" ||
			!browser.selectedProfessorId ||
			browser.isAnalyzing
		) {
			return;
		}

		setBottomPanelMode("dock-exit");
		await new Promise((resolve) => {
			window.setTimeout(resolve, DOCK_EXIT_DURATION_MS);
		});

		setBottomPanelMode("loading");
		await browser.handleAnalyzeSelectedProfessor();
		setBottomPanelMode("result");
	};

	const handleCloseResult = () => {
		setBottomPanelMode("dock");
		browser.clearAnalysis();
	};

	return (
		<main className="app">
			<header className="header">
				<h1>RateMyProfessor Sentiment Analyzer</h1>
				<p>
					Search by professor or course and compare ratings with real sentiment
					analysis.
				</p>
			</header>

			<section className="panel">
				<div className="field">
					<label htmlFor="school">School</label>
					<select
						id="school"
						value={browser.selectedSchoolName}
						onChange={(event) => handleSchoolChange(event.target.value)}
					>
						<option value="">Select a school</option>
						{browser.schoolOptions.map((school) => (
							<option key={school.id} value={school.name}>
								{school.name}
							</option>
						))}
					</select>
				</div>
			</section>

			{browser.selectedSchoolName && (
				<>
					<section className="panel">
						<SearchModeToggle
							value={searchMode}
							onChange={handleSearchModeChange}
						/>
					</section>

					{searchMode === "professors" ? (
						<section className="panel controls">
							<div className="field">
								<label htmlFor="department-filter">Department</label>
								<select
									id="department-filter"
									value={browser.departmentFilter}
									onChange={(event) =>
										handleDepartmentChange(event.target.value)
									}
									disabled={
										browser.isLoadingProfessors ||
										browser.professors.length === 0
									}
								>
									{browser.departmentOptions.map((department) => (
										<option key={department} value={department}>
											{department === "all" ? "All Departments" : department}
										</option>
									))}
								</select>
							</div>

							<div className="field">
								<label htmlFor="name-search">Search by Name</label>
								<input
									id="name-search"
									type="text"
									value={browser.nameQuery}
									onChange={(event) =>
										handleNameQueryChange(event.target.value)
									}
									placeholder="Start typing a professor name"
									disabled={browser.isLoadingProfessors}
								/>
							</div>
						</section>
					) : (
						<section className="panel">
							<CourseSearchForm
								courseCode={courseCode}
								onCourseCodeChange={setCourseCode}
								onSubmit={handleCourseSubmit}
								isLoading={isLoadingCourseProfessors}
								disabled={!browser.selectedSchoolId}
							/>
						</section>
					)}

					{activeListError && (
						<p className="error" role="alert">
							{activeListError}
						</p>
					)}

					<section className="panel">
						<div className="panel-head">
							<h2>
								{searchMode === "professors"
									? "Professors"
									: "Course Professors"}
							</h2>
							<p>
								Showing {firstShown}-{lastShown} of {activeProfessors.length}
							</p>
						</div>

						{!isActiveListLoading && activeProfessors.length > PAGE_SIZE && (
							<div
								className="pagination pagination-top"
								aria-label="Professor list pagination"
							>
								<button
									type="button"
									onClick={() =>
										searchMode === "professors"
											? setProfessorPage((page) => Math.max(1, page - 1))
											: setCoursePage((page) => Math.max(1, page - 1))
									}
									disabled={currentPage === 1}
									aria-label="Previous page"
									title="Previous page"
								>
									&lt;
								</button>
								<span className="pagination-status">
									Page {currentPage} of {totalPages}
								</span>
								<button
									type="button"
									onClick={() =>
										searchMode === "professors"
											? setProfessorPage((page) =>
													Math.min(totalPages, page + 1),
												)
											: setCoursePage((page) => Math.min(totalPages, page + 1))
									}
									disabled={currentPage === totalPages}
									aria-label="Next page"
									title="Next page"
								>
									&gt;
								</button>
							</div>
						)}

						<ProfessorGrid
							professors={paginatedProfessors}
							isLoading={isActiveListLoading}
							selectedProfessorId={selectedProfessorId}
							onSelectProfessor={handleProfessorSelect}
							emptyLabel={
								searchMode === "professors"
									? "No professors found for the current filters."
									: "No professors found for this course at the selected school."
							}
							loadingCardCount={10}
							showRanking={searchMode === "course"}
							rankOffset={(currentPage - 1) * PAGE_SIZE}
						/>
					</section>

					<div className="analysis-dock-spacer" aria-hidden="true" />

					{searchMode === "professors" ? (
						<>
							{bottomPanelMode === "dock" || bottomPanelMode === "dock-exit" ? (
								<section
									className={`bottom-dock ${bottomPanelMode === "dock-exit" ? "is-exiting" : ""}`}
								>
									<p className="bottom-dock-text">
										{browser.selectedProfessor ? (
											<>
												Selected:{" "}
												<strong>{browser.selectedProfessor.name}</strong>. Click
												Analyze to compare RateMyProfessor rating and sentiment
												rating.
											</>
										) : (
											"Select a professor card to enable analysis."
										)}
									</p>
									<button
										type="button"
										className="bottom-dock-analyze"
										onClick={handleAnalyzeClick}
										disabled={
											!browser.selectedProfessorId || browser.isAnalyzing
										}
									>
										Analyze
									</button>
								</section>
							) : null}

							{bottomPanelMode === "loading" ? (
								<section
									className="bottom-result-panel is-loading"
									aria-live="polite"
								>
									<div className="spinner" aria-hidden="true" />
									<p>Analyzing selected professor...</p>
								</section>
							) : null}

							{bottomPanelMode === "result" ? (
								<section
									key={professorResultKey}
									className="bottom-result-panel"
									aria-live="polite"
								>
									<button
										type="button"
										className="bottom-result-close"
										onClick={handleCloseResult}
										aria-label="Close analysis"
										title="Close analysis"
									>
										x
									</button>

									{browser.analysisError ? (
										<p className="error" role="alert">
											{browser.analysisError}
										</p>
									) : browser.analysis ? (
										<AnalysisPanel analysis={browser.analysis} />
									) : (
										<p className="muted">No analysis data available.</p>
									)}
								</section>
							) : null}
						</>
					) : (
						<section
							key={coursePanelKey}
							className="bottom-result-panel"
							aria-live="polite"
						>
							{selectedCourseAnalysis ? (
								<>
									<button
										type="button"
										className="bottom-result-close"
										onClick={() => setSelectedCourseProfessorId("")}
										aria-label="Close analysis"
										title="Close analysis"
									>
										x
									</button>
									<AnalysisPanel analysis={selectedCourseAnalysis} />
								</>
							) : isLoadingCourseProfessors ? (
								<div className="bottom-inline-loading" role="status">
									<div className="spinner" aria-hidden="true" />
									<p>Searching and ranking professors for this course...</p>
								</div>
							) : courseProfessorsError ? (
								<p className="error" role="alert">
									{courseProfessorsError}
								</p>
							) : courseProfessors.length > 0 ? (
								<p className="muted bottom-panel-message">
									Select a professor card to view analysis details.
								</p>
							) : (
								<p className="muted bottom-panel-message">
									Enter a course code and submit to fetch analyzed professors.
								</p>
							)}
						</section>
					)}
				</>
			)}
		</main>
	);
}

export default App;
