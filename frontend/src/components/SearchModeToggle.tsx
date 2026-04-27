export type SearchMode = "professors" | "course";

type SearchModeToggleProps = {
	value: SearchMode;
	onChange: (mode: SearchMode) => void;
	disabled?: boolean;
};

export function SearchModeToggle({
	value,
	onChange,
	disabled = false,
}: SearchModeToggleProps) {
	return (
		<div
			className="search-mode-switch"
			role="radiogroup"
			aria-label="Search mode"
		>
			<button
				type="button"
				role="radio"
				aria-checked={value === "professors"}
				className={value === "professors" ? "is-active" : ""}
				onClick={() => onChange("professors")}
				disabled={disabled}
			>
				Browse Professors
			</button>
			<button
				type="button"
				role="radio"
				aria-checked={value === "course"}
				className={value === "course" ? "is-active" : ""}
				onClick={() => onChange("course")}
				disabled={disabled}
			>
				Search By Course
			</button>
		</div>
	);
}
