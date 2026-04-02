export default class Matrix {
	constructor(svg) {
		this.svg = svg || document.createElementNS("http://www.w3.org/2000/svg", "svg");

		this.vtm = this.createSVGMatrix();

		this.x = 0;
		this.y = 0;

		this.captureScale = 1;
	}

	clamp(scale, in_x, in_y, ratio) {
		let xx = (window.innerWidth - ratio.width) / 2;
		let yy = (window.innerHeight - ratio.height) / 2;

		let limit_max_right_formula = xx * scale + ratio.width * scale - window.innerWidth;

		let same_x = Math.min(this.vtm.e * 1.0, 0);
		let same_y = Math.min(this.vtm.f * 1.0, 0);

		let value1 = in_x > 0 ? same_x : -(xx * scale);
		let value2 = in_x > 0 ? same_x : -limit_max_right_formula;

		let limit_x_axis = this.vtm.e;
		limit_x_axis = Math.max(value2, this.vtm.e);
		limit_x_axis = Math.min(value1, limit_x_axis);

		let limit_max_bottom_formula = yy * scale + ratio.height * scale - window.innerHeight;
		let limit_max_top = in_y > 0 ? same_y : -(yy * scale);
		let limit_max_bottom = in_y > 0 ? same_y : -limit_max_bottom_formula;

		let limit_y_axis = this.vtm.f;
		limit_y_axis = Math.min(limit_max_top, limit_y_axis);
		limit_y_axis = Math.max(limit_y_axis, limit_max_bottom);

		this.vtm = this.createSVGMatrix().translate(limit_x_axis, limit_y_axis).scale(Math.max(this.vtm.a, 1));
	}

	createSVGMatrix() {
		return this.svg.createSVGMatrix();
	}

	move(x, y, in_x, in_y, ratio) {
		this.vtm = this.createSVGMatrix()
			.translate(this.x - x, this.y - y)
			.scale(this.vtm.a);

		this.clamp(this.vtm.a, in_x, in_y, ratio);
		return this.vtm;
	}

	scale(xFactor, yFactor, origin, in_x, in_y, ratio, max, value, dir) {
		if ((value >= max || this.stop) && dir === 1) {
			this.stop = true;
			if (!this.deb) {
				this.captureScale = this.vtm.a;
				this.vtm = this.createSVGMatrix()
					.translate(origin.x, origin.y)
					.scale(max / this.captureScale)
					.translate(-origin.x, -origin.y)
					.translate(this.vtm.e, this.vtm.f)
					.scale(this.captureScale);

				this.deb = true;
			}
			return this.vtm;
		} else {
			this.stop = false;
		}

		this.vtm = this.createSVGMatrix()
			.translate(origin.x, origin.y)
			.scale(xFactor, yFactor)
			.translate(-origin.x, -origin.y)
			.multiply(this.vtm);

		let pre_scale = Math.min(Math.max(1, this.vtm.a), max);

		this.clamp(pre_scale, in_x, in_y, ratio);

		return this.vtm;
	}
}
