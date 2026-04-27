import type { Professor } from "../utils/types";

type ProfessorGridProps = {
	professors: Professor[];
	isLoading: boolean;
	selectedProfessorId: string;
	onSelectProfessor: (professorId: string) => void;
	emptyLabel?: string;
	loadingCardCount?: number;
	showRanking?: boolean;
	rankOffset?: number;
};

function SkeletonCards({ cardCount }: { cardCount: number }) {
	return (
		<div className="professor-grid">
			{Array.from({ length: cardCount }).map((_, index) => (
				<article
					key={index}
					className="professor-card skeleton"
					aria-hidden="true"
				>
					<div className="skeleton-line skeleton-title" />
					<div className="skeleton-line" />
					<div className="skeleton-line skeleton-short" />
				</article>
			))}
		</div>
	);
}

export function ProfessorGrid({
	professors,
	isLoading,
	selectedProfessorId,
	onSelectProfessor,
	emptyLabel = "No professors found for the current filters.",
	loadingCardCount = 8,
	showRanking = false,
	rankOffset = 0,
}: ProfessorGridProps) {
	if (isLoading) {
		return <SkeletonCards cardCount={loadingCardCount} />;
	}

	if (professors.length === 0) {
		return <p className="empty-state">{emptyLabel}</p>;
	}

	return (
		<div className="professor-grid">
			{professors.map((professor, index) => {
				const isSelected = professor.professorId === selectedProfessorId;
				const rank = rankOffset + index + 1;
				const cardKey = `${professor.professorId}:${professor.name}:${professor.department}:${index}`;

				return (
					<button
						key={cardKey}
						type="button"
						className={`professor-card ${isSelected ? "selected" : ""}`}
						onClick={() => onSelectProfessor(professor.professorId)}
					>
						<div className="professor-card-head">
							<h3>{professor.name}</h3>
							{showRanking && rank <= 5 ? (
								<span
									className={`rank-badge ${
										rank === 1
											? "gold"
											: rank === 2
												? "silver"
												: rank === 3
													? "bronze"
													: "top-five"
									}`}
								>
									#{rank}
								</span>
							) : null}
						</div>
						<p>{professor.department}</p>
						<p className="rating">
							RMP Rating: {professor.rmpRating.toFixed(1)}
						</p>
						{typeof professor.sentimentScore === "number" ? (
							<p className="rating">
								Sentiment: {professor.sentimentScore.toFixed(2)}
							</p>
						) : null}
					</button>
				);
			})}
		</div>
	);
}
