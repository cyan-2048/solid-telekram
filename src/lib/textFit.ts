/**
 * textFit v2.3.1
 * Previously known as jQuery.textFit
 * 11/2014 by STRML (strml.github.com)
 * MIT License
 *
 * To use: textFit(document.getElementById('target-div'), options);
 *
 * Will make the *text* content inside a container scale to fit the container
 * The container is required to have a set width and height
 * Uses binary search to fit text with minimal layout calls.
 * Version 2.0 does not use jQuery.
 *
 * code was modified by Cyan
 */

var defaultSettings = {
	// alignVert: false, // if true, textFit will align vertically using css tables
	// alignHoriz: false, // if true, textFit will set text-align: center
	multiLine: false, // if true, textFit will not set white-space: no-wrap
	detectMultiLine: true, // disable to turn off automatic multi-line sensing
	minFontSize: 6,
	maxFontSize: 80,
	// reProcess: true, // if true, textFit will re-process already-fit nodes. Set to 'false' for better performance
	widthOnly: false, // if true, textFit will fit text to element width, regardless of text height
	// alignVertWithFlexbox: false, // if true, textFit will use flexbox for vertical alignment

	/**
	 * called when the font-size is found
	 */
	fontSize: (_: string) => {},
};

type Settings = Partial<typeof defaultSettings>;

export function textFit(el: HTMLElement, options: Settings) {
	if (!options) options = {};

	// Extend options.
	const settings: Required<Settings> = { ...defaultSettings, ...options };

	processItem(el, settings);
}

/**
 * The meat. Given an el, make the text inside it fit its parent.
 * @param  {DOMElement} el       Child el.
 * @param  {Object} settings     Options for fit.
 */
function processItem(el: HTMLElement, settings: Required<Settings>) {
	// if (!isElement(el) || (!settings.reProcess && el.getAttribute("textFitted"))) {
	// 	return false;
	// }

	// Set textFitted attribute so we know this was processed.
	// if (!settings.reProcess) {
	// 	el.setAttribute("textFitted", "1");
	// }

	const innerSpan = document.createElement("span");
	let originalHeight: number, originalWidth: number;
	let low: number, mid: number, high: number;

	// Get element data.
	// originalHTML = el.innerHTML;
	originalWidth = innerWidth(el);
	originalHeight = innerHeight(el);

	// Don't process if we can't find box dimensions
	if (!originalWidth || (!settings.widthOnly && !originalHeight)) {
		if (!settings.widthOnly)
			throw new Error("Set a static height and width on the target element " + el.outerHTML + " before using textFit!");
		else throw new Error("Set a static width on the target element " + el.outerHTML + " before using textFit!");
	}

	// Add textFitted span inside this container.
	// if (originalHTML.indexOf("textFitted") === -1) {
	// innerSpan.className = "textFitted";
	// Inline block ensure it takes on the size of its contents, even if they are enclosed
	// in other tags like <p>

	// !!!!
	// innerSpan.style["display"] = "inline-block";

	// innerSpan.innerHTML = originalHTML;
	// el.innerHTML = "";

	innerSpan.append(...el.childNodes);

	el.appendChild(innerSpan);
	// }
	// this part shouldn't happen
	// else {
	// 	// Reprocessing.
	// 	innerSpan = el.querySelector("span.textFitted");
	// 	// Remove vertical align if we're reprocessing.
	// 	if (hasClass(innerSpan, "textFitAlignVert")) {
	// 		innerSpan.className = innerSpan.className.replace("textFitAlignVert", "");
	// 		innerSpan.style["height"] = "";
	// 		el.className.replace("textFitAlignVertFlex", "");
	// 	}
	// }

	// Check if this string is multiple lines
	// Not guaranteed to always work if you use wonky line-heights
	let multiLine = settings.multiLine;
	if (
		settings.detectMultiLine &&
		!multiLine &&
		innerSpan.getBoundingClientRect().height >= parseInt(window.getComputedStyle(innerSpan).fontSize, 10) * 2
	) {
		multiLine = true;
	}

	// If we're not treating this as a multiline string, don't let it wrap.
	if (!multiLine) {
		el.style.whiteSpace = "nowrap";
	}

	low = settings.minFontSize;
	high = settings.maxFontSize;

	// Binary search for highest best fit
	let size = low;
	while (low <= high) {
		mid = (high + low) >> 1;
		innerSpan.style.fontSize = mid + "px";
		var innerSpanBoundingClientRect = innerSpan.getBoundingClientRect();
		if (
			innerSpanBoundingClientRect.width <= originalWidth &&
			(settings.widthOnly || innerSpanBoundingClientRect.height <= originalHeight)
		) {
			size = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
		// await injection point
	}
	// found, updating font if differs:
	if (innerSpan.style.fontSize != size + "px") innerSpan.style.fontSize = size + "px";

	settings.fontSize(innerSpan.style.fontSize);
}

// Calculate height without padding.
function innerHeight(el: HTMLElement) {
	var style = window.getComputedStyle(el, null);
	return (
		el.getBoundingClientRect().height -
		parseInt(style.getPropertyValue("padding-top"), 10) -
		parseInt(style.getPropertyValue("padding-bottom"), 10)
	);
}

// Calculate width without padding.
function innerWidth(el: HTMLElement) {
	var style = window.getComputedStyle(el, null);
	return (
		el.getBoundingClientRect().width -
		parseInt(style.getPropertyValue("padding-left"), 10) -
		parseInt(style.getPropertyValue("padding-right"), 10)
	);
}

//Returns true if it is a DOM element
// function isElement(o: HTMLElement) {
// 	return typeof HTMLElement === "object"
// 		? o instanceof HTMLElement //DOM2
// 		: o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName === "string";
// }

// function hasClass(element:HTMLElement, cls: string) {
// 	return element.classList.contains(cls)
// }

// // Better than a stylesheet dependency
// function addStyleSheet() {
// 	if (document.getElementById("textFitStyleSheet")) return;
// 	var style = [
// 		".textFitAlignVert{",
// 		"position: absolute;",
// 		"top: 0; right: 0; bottom: 0; left: 0;",
// 		"margin: auto;",
// 		"display: flex;",
// 		"justify-content: center;",
// 		"flex-direction: column;",
// 		"}",
// 		".textFitAlignVertFlex{",
// 		"display: flex;",
// 		"}",
// 		".textFitAlignVertFlex .textFitAlignVert{",
// 		"position: static;",
// 		"}",
// 	].join("");

// 	var css = document.createElement("style");
// 	css.type = "text/css";
// 	css.id = "textFitStyleSheet";
// 	css.innerHTML = style;
// 	document.body.appendChild(css);
// }
