import { getCountryForTimezone } from "countries-and-timezones";
import moment from "moment-timezone";

function guess(bool?: boolean) {
	return moment.tz.guess(bool);
}

export { getCountryForTimezone, guess };
