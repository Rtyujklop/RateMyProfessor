#!/usr/bin/env bash

set -euo pipefail

# Always run relative to this script's directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v zip >/dev/null 2>&1; then
	echo "Error: 'zip' command not found. Please install zip and try again."
	exit 1
fi

shopt -s nullglob

for lambda_dir in "$SCRIPT_DIR"/*/; do
	lambda_name="$(basename "$lambda_dir")"
	package_dir="${lambda_dir}package"
	output_zip="${lambda_dir}${lambda_name}.zip"

	if [[ ! -d "$package_dir" ]]; then
		echo "Skipping ${lambda_name}: no package directory found"
		continue
	fi

	rm -f "$output_zip"

	(
		cd "$package_dir"
		zip -r "$output_zip" . >/dev/null
	)

	echo "Built ${output_zip}"
done

echo "Done building lambda package archives."
