export default function parseUserAgent(a: string) {
	let model = navigator.appCodeName;
	try {
		let idx = a.indexOf("Mobile;");
		if (idx != -1) {
			let m = a.substring(idx + 8);
			let idx2 = m.indexOf(")");
			m = m.substring(0, idx2);
			if (m != "") model = m;
		}
	} catch (err) {}

	let version = "1.0";
	try {
		if (a.indexOf("KAIOS/") > -1) {
			version = a.substring(a.indexOf("KAIOS/"));
		} else if (a.indexOf("Firefox/") > -1) {
			version = a.substring(a.indexOf("Firefox/"));
		} else if (a.indexOf("Gecko/") > -1) {
			version = a.substring(a.indexOf("Gecko/"));
		} else if (a.indexOf("rv:") > -1) {
			let idx = a.indexOf("rv:");
			if (idx != -1) {
				let v = a.substring(idx);
				let idx2 = v.indexOf(")");
				v = v.substring(0, idx2);
				if (v != "") version = v;
			}
		}
	} catch (err) {}
	return { deviceModel: model, systemVersion: version };
}

export { parseUserAgent };
