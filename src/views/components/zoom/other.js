function calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
	var ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);

	return { width: srcWidth * ratio, height: srcHeight * ratio, ratio };
}

function getDistance(touchA, touchB) {
	return Math.hypot(touchA.pageX - touchB.pageX, touchA.pageY - touchB.pageY);
}

export { calculateAspectRatioFit, getDistance };
