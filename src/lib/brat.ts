// taken from the bratgenerator website

function hasDecimal(number: number) {
	var sqrt = Math.sqrt(number);
	return sqrt !== Math.floor(sqrt);
}

function createDiamond(sentence: string) {
	const words = sentence.split(" "); // Split sentence into words
	const len = words.length;

	/* const groups = [
                words.slice(0, 1),  // First group: 1 word
                words.slice(1, 3),  // Second group: 2 words
                words.slice(3, 7),  // Third group: 4 words
                words.slice(7, 11), // Fourth group: 4 words
                words.slice(11, 14),// Fifth group: 3 words
                words.slice(14, 15),// Sixth group: 1 word
                words.slice(15)     // Seventh group: remaining words
            ];*/
	const groups = [];
	let num1 = 0;
	let num2 = 0;

	const sqrtlen = Math.floor(Math.sqrt(words.length));

	for (let i = 0; i < sqrtlen; i++) {
		num1 = num2;
		num2 = num2 + i + 1;
		groups.push(words.slice(num1, num2));
	}

	if (hasDecimal(words.length)) {
		for (let j = sqrtlen; j >= 1; j--) {
			num1 = num2;
			num2 = num2 + j;
			groups.push(words.slice(num1, num2));
		}
		if (len > num2) {
			for (let z = 0; z < len - num2; z++) {
				num1 = num2;
				num2 = num2 + 1;
				console.log(num1 + "," + num2);
				groups.push(words.slice(num1, num2));
			}
		}
	} else {
		for (let j = sqrtlen; j > 1; j--) {
			num1 = num2;
			num2 = num2 + j - 1;
			// console.log(num1 + "," + num2);
			groups.push(words.slice(num1, num2));
		}
	}

	const result: string[] = [];

	// Loop through word groups and display them
	groups.forEach(function (group, i) {
		if (group.length > 0) {
			let spaces = " ".repeat((groups.length - i - 1) * 2); // Add spaces for centering
			let row = spaces + group.join(" "); // Join words in the group
			result.push(row);
		}
	});

	return result;
}
