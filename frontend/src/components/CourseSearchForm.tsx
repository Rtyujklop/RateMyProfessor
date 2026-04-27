import type { FormEvent } from "react";

type CourseSearchFormProps = {
	courseCode: string;
	onCourseCodeChange: (value: string) => void;
	onSubmit: () => void;
	isLoading: boolean;
	disabled?: boolean;
};

export function CourseSearchForm({
	courseCode,
	onCourseCodeChange,
	onSubmit,
	isLoading,
	disabled = false,
}: CourseSearchFormProps) {
	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onSubmit();
	}

	return (
		<form className="course-search" onSubmit={handleSubmit}>
			<div className="field">
				<label htmlFor="course-code">Course Code</label>
				<input
					id="course-code"
					type="text"
					value={courseCode}
					onChange={(event) => onCourseCodeChange(event.target.value)}
					placeholder="e.g. SWEN-514"
					disabled={disabled || isLoading}
				/>
			</div>
			<button
				type="submit"
				disabled={disabled || isLoading || !courseCode.trim()}
			>
				{isLoading ? "Searching..." : "Submit"}
			</button>
		</form>
	);
}
