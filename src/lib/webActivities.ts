export function supportsActivity() {
	// @ts-ignore
	return typeof MozActivity !== "undefined" || typeof WebActivity !== "undefined";
}

export function startActivity<Result = any, Data = {}>(name: string, data: Data) {
	// @ts-ignore:  KaiOS 2.5 uses MozActivity
	if (typeof MozActivity !== "undefined") {
		return new Promise<Result>((resolve, reject) => {
			// @ts-ignore
			new MozActivity<Result>({ name, data }).then(resolve, reject);
		});

		// KaiOS 3.0 uses WebActivity
		// @ts-ignore
	} else if (typeof WebActivity !== "undefined") {
		// @ts-ignore
		let activity = new WebActivity(name, data);

		return activity.start() as Promise<Result>;
	}

	// Not KaiOS?

	return Promise.resolve(null);
}
