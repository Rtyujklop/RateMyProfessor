export const SCHOOL_NAME_TO_ID: Record<string, string> = {
	"Rochester Institute of Technology": "807",
	"University of Rochester": "1331",
	"Syracuse University": "992",
	"University at Buffalo": "960",
};

export const SCHOOL_OPTIONS = Object.entries(SCHOOL_NAME_TO_ID).map(
	([name, id]) => ({ name, id }),
);
