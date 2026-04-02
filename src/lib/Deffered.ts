export default class Deferred<T> {
	promise: Promise<T>;
	reject!: (reason?: any) => void;
	resolve!: (value: T | PromiseLike<T>) => void;

	constructor() {
		if (typeof Promise.withResolvers == "function") {
			const deferred = Promise.withResolvers<T>();
			this.promise = deferred.promise;
			this.reject = deferred.reject;
			this.resolve = deferred.resolve;
		} else {
			this.promise = new Promise<T>((resolve, reject) => {
				this.reject = reject;
				this.resolve = resolve;
			});
		}
	}
	static resolved<T>(value: T) {
		const deferred = new Deferred<T>();
		deferred.resolve(value);
		return deferred;
	}
}
