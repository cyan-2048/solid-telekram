import type { GifCategories, GifResult } from "@/ui/UIGifPicker";
import Options from "../components/Options";
import * as styles from "./GifPicker.module.scss";
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	type JSXElement,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import scrollIntoView from "scroll-into-view-if-needed";
import { clampImageDimension, inColumns, niceBytes, setSoftkeys, sleep } from "@utils";
import SpatialNavigation from "@/lib/spatial_navigation";
import { gifPicker } from "@globals";
import { Thumbnail, type Video } from "@mtcute/core";
import { downloadFile } from "@/lib/storage";
import Search from "../components/Search";
import Content from "../components/Content";
import ProgressSpinner from "../components/ProgressSpinner";
import { cloudphone } from "@/config";

const icons: Record<GifCategories, JSXElement> = {
	love: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="22"
			height="22"
			style="width:100%;height:100%;transform:translate3d(0,0,0);content-visibility:visible"
			viewBox="0 0 512 512"
		>
			<defs>
				<clipPath id="__lottie_element_25">
					<path d="M0 0h512v512H0z" />
				</clipPath>
			</defs>
			<g clip-path="url(#__lottie_element_25)">
				<path
					fill="none"
					stroke="currentColor"
					stroke-miterlimit="10"
					stroke-width="40"
					d="M32.26800156 221.97599792c-18.23300171 17.7480011-46.3030014 17.74700928-64.53600312-.2579956l-2.63899994-2.57200623C-160.85899353 96.96900177-243.14700317 16.97599983-240.02799988-82.82299805c1.43899536-43.72600555 22.31199646-85.65200805 56.13899231-110.34500122C-120.5530014-239.46699524-42.34400177-204.1060028-.12-151.11999512c42.2240001-52.98600769 120.43300354-88.6040039 183.76900208-42.04800415 33.82699584 24.69299317 54.69900512 66.61899567 56.1389923 110.34500122 3.3590088 99.79899788-79.16899108 179.79299927-205.12099456 302.48399353l-2.39899826 2.31500244z"
					style="display:block"
					transform="translate(256.08036012 259.37386799) scale(.71111)"
				/>
			</g>
		</svg>
	),
	approval: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="22"
			height="22"
			style="width:100%;height:100%;transform:translate3d(0,0,0);content-visibility:visible"
			viewBox="0 0 512 512"
		>
			<defs>
				<clipPath id="__lottie_element_8">
					<path d="M0 0h512v512H0z" />
				</clipPath>
			</defs>
			<g
				fill="none"
				stroke="currentColor"
				stroke-miterlimit="10"
				clip-path="url(#__lottie_element_8)"
				style="display:block"
			>
				<path
					stroke-width="27.02218"
					d="M85.33359623 391.11089444V243.1438305c0-19.63657945 15.9189095-35.5554998 35.5554998-35.5554998h41.29771083c10.96460954-.00425346 21.31338888-5.06665871 28.04688527-13.72013907 24.95640617-32.11231942 40.30073974-52.2523703 46.03371686-60.41876374 29.93842961-42.6488155 33.95478616-62.33661014 67.66708138-62.33661014 12.1109185 0 28.71961641 8.89385541 28.71961641 29.60066972 0 22.36938766-6.74916476 56.46781509-20.24814533 102.29459868-.55965624 1.88231042.50629261 3.8648811 2.38719244 4.43020139.33563316.1009764.68337567.15075931 1.03393935.15004317h63.69553813c28.6648422 0 51.90252276 23.23765886 51.90252276 51.90250106 0 4.74168093-.64995558 9.46131329-1.93137718 14.026649l-28.42165681 101.25567888c-8.61365837 30.68649701-36.59299817 51.89323458-68.46495339 51.89323458H120.88909602c-19.6365903 0-35.55549979-15.91889864-35.55549979-35.55549979z"
				/>
				<path stroke-width="28.4444" d="m167.11124575 209.7778455 2.9959046 206.14650829" />
			</g>
		</svg>
	),
	disapproval: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="22"
			height="22"
			style="width:100%;height:100%;transform:translate3d(0,0,0);content-visibility:visible"
			viewBox="0 0 512 512"
		>
			<defs>
				<clipPath id="__lottie_element_13">
					<path d="M0 0h512v512H0z" />
				</clipPath>
			</defs>
			<g
				fill="none"
				stroke="currentColor"
				stroke-miterlimit="10"
				clip-path="url(#__lottie_element_13)"
				style="display:block"
			>
				<path
					stroke-width="27.02218"
					d="M92.44469547 128.00022006V275.967284c0 19.63657945 15.9189095 35.5554998 35.5554998 35.5554998h41.29771083c10.96460954.00425346 21.31338889 5.06665872 28.04688527 13.72013907 24.95640617 32.11231943 40.30073975 52.2523703 46.03371686 60.41876375 29.93842961 42.64881549 33.95478616 62.33661013 67.66708138 62.33661013 12.1109185 0 28.71961642-8.8938554 28.71961642-29.60066972 0-22.36938766-6.74916477-56.46781509-20.24814533-102.29459868-.55965624-1.88231042.5062926-3.8648811 2.38719243-4.43020139.33563316-.1009764.68337567-.1507593 1.03393936-.15004316h63.69553812c28.6648422 0 51.90252276-23.23765887 51.90252276-51.90250107 0-4.74168093-.64995557-9.46131329-1.93137717-14.026649l-28.42165682-101.25567888c-8.61365836-30.686497-36.59299816-51.89323458-68.46495339-51.89323458H128.00019526c-19.6365903 0-35.55549979 15.91889864-35.55549979 35.55549979z"
				/>
				<path stroke-width="28.4444" d="m174.222345 309.333269 2.99590458-206.14650829" />
			</g>
		</svg>
	),
	cheers: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="22"
			height="22"
			style="width:100%;height:100%;transform:translate3d(0,0,0);content-visibility:visible"
			viewBox="0 0 512 512"
		>
			<defs>
				<clipPath id="__lottie_element_18">
					<path d="M0 0h512v512H0z" />
				</clipPath>
			</defs>
			<g clip-path="url(#__lottie_element_18)">
				<g fill="none" stroke="currentColor" stroke-miterlimit="10" style="display:block">
					<path
						stroke-linecap="round"
						stroke-width="27.02483886"
						d="m177.12459283 172.71916127-98.70755899 202.3633118c-8.74404695 17.92559232-5.944808 39.33984023 7.11227764 54.4163977l.33569056.38758006c12.95608435 14.95922108 34.23332709 19.56692154 52.21807022 11.30949384l213.64499716-98.0948197"
					/>
					<path
						stroke-linecap="round"
						stroke-width="27.02483886"
						d="M272.01889039 196.97064962c-40.53061819-33.86639362-78.21093574-50.52091198-90.66326388-38.0677199-15.12982683 15.13088313 12.71398748 67.50191473 62.19037254 116.97555658 49.47638233 49.47293105 101.85078198 77.31379985 116.98060882 62.18291672 7.34623397-7.34674685 4.5613954-23.4726577-5.91143215-43.78287961"
					/>
					<path
						stroke-width="28.4471988"
						d="M128.2892466 273.29735794c5.2174973 28.44274662 17.91434955 53.34498187 38.0912716 74.70599086 20.17692156 21.36100764 44.79420783 35.78003144 73.85114783 43.25636335"
					/>
				</g>
				<g style="display:block">
					<path
						fill="currentColor"
						d="m394.34892246 135.32342902 14.16008725 14.15198717c3.02262014 3.01529757 3.02990298 7.91532733.00749361 10.93794772l-.0071118 2.4e-7-14.15909922 14.1529757c-3.02240962 3.01550859-7.91532783 3.01567939-10.93794797.00038181l-14.16008725-14.15198717c-3.02262013-3.01529758-3.02990298-7.91532733-.0074936-10.93794772l.0071118-2.5e-7 14.15909922-14.1529757c3.02240962-3.01550858 7.91532783-3.01567938 10.93794796-.0003818zm-272.07648913 9.21999368 9.13898139 9.13123184c3.02262013 3.01529757 3.02990298 7.91532733.0074936 10.93794772l-.0071118 2.4e-7-9.13834388 9.13186984c-3.02240938 3.02262039-7.91532758 3.02279118-10.93794797.0003818l-9.13898138-9.13123183c-3.02262014-3.01529757-3.02990298-7.91532733-.00749361-10.93794772l.0071118-2.4e-7 9.13834389-9.13186984c3.02240937-3.02262039 7.91532782-3.01567938 10.93794796-.0003818zM425.0324777 82.59279969c9.29421007-.00032443 16.82852735-7.53232649 16.82820307-16.82227486-.00032428-9.28993752-7.53516737-16.82140272-16.82937745-16.8210783-9.29421008.00032444-16.82923222 7.53231567-16.82890794 16.8222532.00032428 9.28994837 7.53587224 16.82142439 16.83008232 16.82109996zM253.50389528 62.10931195c7.33565231-.00025606 13.28161855-5.94448828 13.28136261-13.27658842-.00025594-7.33210015-5.94663712-13.27522281-13.28228943-13.27496675-7.3356523.00025606-13.28232927 5.94379387-13.28207334 13.27589402.00025594 7.33210015 5.94734785 13.27591722 13.28300016 13.27566115zM466.601985 224.74909405c9.29421008-.00032443 16.82923222-7.53232109 16.82890794-16.82226404-.00032428-9.28994294-7.53587221-16.82070325-16.8300823-16.82037883-9.29421007.00032443-16.82851653 7.53161078-16.82819225 16.82155373.00032428 9.28994295 7.53515653 16.82141357 16.8293666 16.82108914z"
					/>
					<path
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-miterlimit="10"
						stroke-width="28.4471988"
						d="M267.08346473 221.95599396c-.00082853-23.73563156 43.87040875-24.6524534 48.13734172-49.24165044 4.2669323-24.58919568-30.42257534-32.66272226-27.51263993-59.14787664 2.17125429-19.76590296 28.28762293-28.16513755 40.51323838-36.17060373 7.23466873-4.73742455 7.75571495-11.81937303 7.75563849-14.00980865m-30.69836221 195.1168472c37.9011483-13.7214064 61.61234347-21.04809922 71.13216608-21.98007691 36.5737248-3.57993467 50.4153156 13.6713862 50.4153156 13.6713862m5.37376255 63.72155926c1.0536547 11.37884279-21.20587171 43.40689896-15.88813475 50.42037038 8.24793396 10.87863226 36.01001452-16.71754215 40.1602259-3.0943237 4.95678107 16.2702029-8.1677245 45.82232208-15.76989797 55.59562304M208.48979621 112.56504689c-5.51815574-23.4687458-18.20879518-53.7283-43.69921911-62.64774008-15.28628936-5.3489617-47.82262532 19.28602558-17.08422314 53.74659903"
					/>
				</g>
			</g>
		</svg>
	),
	laughter: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="22"
			height="22"
			style="width:100%;height:100%;transform:translate3d(0,0,0);content-visibility:visible"
			viewBox="0 0 512 512"
		>
			<defs>
				<clipPath id="__lottie_element_36">
					<path d="M0 0h512v512H0z" />
				</clipPath>
			</defs>
			<g clip-path="url(#__lottie_element_36)">
				<path
					fill="none"
					stroke="currentColor"
					stroke-miterlimit="10"
					stroke-width="40"
					d="M0 260c143.59399414 0 260-116.40600586 260-260S143.59399414-260 0-260-260-143.59399414-260 0-143.59399414 260 0 260z"
					style="display:block"
					transform="translate(255.99954503 255.9996796) scale(.71111256)"
				/>
				<path
					fill="currentColor"
					d="M170.66549747 285.78597575c0 16.4359769 38.20530872 39.19162456 85.33367872 39.19162456 47.12837001 0 85.33367873-22.75564766 85.33367873-39.19162456 0-13.30565417-38.20530872 4.71824013-85.33367873 4.71824013-47.12837 0-85.33367872-18.0238943-85.33367872-4.71824013zm85.33367872-18.6930539c58.91081787 0 106.6670984-22.76987027 106.6670984 10.83879848 0 52.68856775-47.75628053 95.40163126-106.6670984 95.40163126-58.91081786 0-106.6670984-42.71306351-106.6670984-95.40163126 0-33.60866875 47.75628054-10.83879848 106.6670984-10.83879848zm56.88911915-75.09363755c11.78244787 0 21.33341968 9.55097182 21.33341968 21.33341968v14.22227979c0 3.92748172-3.18365546 7.1111399-7.11113989 7.1111399h-28.44455957c-3.92748172 0-7.1111399-3.18365818-7.1111399-7.1111399v-14.22227979c0-11.78244786 9.55097182-21.33341968 21.33341968-21.33341968zm-113.77823829 0c11.78244786 0 21.33341968 9.55097182 21.33341968 21.33341968v14.22227979c0 3.92748172-3.18365818 7.1111399-7.1111399 7.1111399h-28.44455957c-3.92748443 0-7.1111399-3.18365818-7.1111399-7.1111399v-14.22227979c0-11.78244786 9.55097182-21.33341968 21.33341969-21.33341968z"
					style="display:block"
				/>
			</g>
		</svg>
	),
	astonishment: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="22"
			height="22"
			style="width:100%;height:100%;transform:translate3d(0,0,0);content-visibility:visible"
			viewBox="0 0 512 512"
		>
			<defs>
				<clipPath id="__lottie_element_46">
					<path d="M0 0h512v512H0z" />
				</clipPath>
			</defs>
			<g clip-path="url(#__lottie_element_46)" style="display:block">
				<path
					fill="none"
					stroke="currentColor"
					stroke-miterlimit="10"
					stroke-width="28.4444"
					d="M255.99999523 440.88859415c102.11112458 0 184.88859892-82.77747434 184.88859892-184.88859892 0-102.11112457-82.77747434-184.88859892-184.88859892-184.88859892-102.11112457 0-184.88859892 82.77747435-184.88859892 184.88859892 0 102.11112458 82.77747435 184.88859892 184.88859892 184.88859892z"
				/>
				<path
					fill="currentColor"
					d="M255.99999523 312.8887949c35.34643437 0 63.99989963 23.14023063 63.99989963 56.07031137 0 21.0054792-28.65346526-.33706545-63.99989963-.33706545-35.34643436 0-63.99989962 21.34254466-63.99989962.33706545 0-32.93008074 28.65346526-56.07031137 63.99989962-56.07031137zm71.11099959-35.5554998c11.7823817 0 21.33329987-12.7352692 21.33329987-28.44439983 0-15.70913063-9.55091818-28.44439983-21.33329987-28.44439983-11.7823817 0-21.33329988 12.7352692-21.33329988 28.44439983 0 15.70913064 9.55091818 28.44439984 21.33329988 28.44439984zm-142.22199917 0c11.7823817 0 21.33329987-12.7352692 21.33329987-28.44439983 0-15.70913063-9.55091818-28.44439983-21.33329987-28.44439983-11.78167098 0-21.33329988 12.7352692-21.33329988 28.44439983 0 15.70913064 9.5516289 28.44439984 21.33329988 28.44439984zm-55.19707055-87.84057403c4.45368225-10.48033838 17.42361633-26.47604355 33.86377067-32.91372877 37.96545153-14.86717503 49.5992115-5.1633708 49.5992115 2.4440934 0 8.42309334-15.41402206 5.8175907-42.8728223 15.21988172-17.48903508 5.98825558-27.99142746 16.02059662-34.3110573 21.32761412-1.13279988.95146335-6.87927524-4.66559598-6.27910257-6.07786047z"
				/>
				<path
					fill="none"
					stroke="currentColor"
					stroke-miterlimit="10"
					stroke-width="4.97777"
					d="M129.6919251 189.49201577c4.45368225-10.48033906 17.42361633-26.47604761 33.86376932-32.91372605 37.96545288-14.86717774 49.59921013-5.16265873 49.59921013 2.44479597 0 8.4230981-15.41401934 5.81687999-42.87282052 15.21917644-17.48903956 5.98825694-27.9914238 16.0213087-34.31105637 21.32832213-1.13279987.95146606-6.87927794-4.666304-6.27910256-6.07856849z"
				/>
				<path
					fill="currentColor"
					d="M383.4906373 193.43796227c-2.31181278-9.8801657-16.5141017-29.54235818-35.19852336-36.85896997-37.9654461-14.86717503-49.59920878-5.1633708-49.59920878 2.4440934 0 8.42309334 15.41401934 5.8175907 42.87282502 15.21988172 18.74769737 6.41919024 29.46768924 17.48619762 35.61167917 22.397122 2.7541298 2.20159702 6.86931431-.82560092 6.31322795-3.20212715z"
				/>
				<path
					fill="none"
					stroke="currentColor"
					stroke-miterlimit="10"
					stroke-width="4.97777"
					d="M383.48992386 193.43796227c-2.3118182-9.88016164-16.51410713-29.54306415-35.19852132-36.85967526-37.96545084-14.86717503-49.59850009-5.16265873-49.59850009 2.44479665 0 8.42309775 15.41330862 5.81687964 42.8721105 15.2191761 18.74770388 6.4191899 29.46839833 17.48690528 35.61238826 22.39783237 2.7541298 2.2015943 6.86861173-.82560092 6.31252265-3.20212986z"
				/>
			</g>
		</svg>
	),
	sadness: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="22"
			height="22"
			style="width:100%;height:100%;transform:translate3d(0,0,0);content-visibility:visible"
			viewBox="0 0 512 512"
		>
			<defs>
				<clipPath id="__lottie_element_51">
					<path d="M0 0h512v512H0z" />
				</clipPath>
			</defs>
			<g clip-path="url(#__lottie_element_51)" style="display:block">
				<path
					fill="none"
					stroke="currentColor"
					stroke-miterlimit="10"
					stroke-width="28.4444"
					d="M255.99999523 440.88859415c102.11112458 0 184.88859892-82.77747434 184.88859892-184.88859892 0-102.11112457-82.77747434-184.88859892-184.88859892-184.88859892-102.11112457 0-184.88859892 82.77747435-184.88859892 184.88859892 0 102.11112458 82.77747435 184.88859892 184.88859892 184.88859892z"
				/>
				<path
					fill="currentColor"
					d="M313.9554599 241.77779531c12.37118285 0 22.39996486-11.14309233 22.39996486-24.88884985s-10.02878201-24.88884985-22.39996487-24.88884985c-12.37118285 0-22.39996487 11.14309233-22.39996487 24.88884985s10.02878202 24.88884985 22.39996487 24.88884985zm-115.19981933 0c12.37118014 0 22.39996487-11.14309233 22.39996487-24.88884985s-10.02878473-24.88884985-22.39996487-24.88884985c-12.37118286 0-22.39996487 11.14309233-22.39996487 24.88884985s10.02878201 24.88884985 22.39996487 24.88884985z"
				/>
				<path
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-miterlimit="10"
					stroke-width="28.4444"
					d="M184.88899565 334.22210156c7.15518626-30.20012964 30.85932931-45.30055016 71.11099958-45.30055016s63.95581333 15.10042052 71.11099959 45.30055016"
				/>
			</g>
		</svg>
	),
	anger: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="22"
			height="22"
			style="width:100%;height:100%;transform:translate3d(0,0,0);content-visibility:visible"
			viewBox="0 0 512 512"
		>
			<defs>
				<clipPath id="__lottie_element_478">
					<path d="M0 0h512v512H0z" />
				</clipPath>
			</defs>
			<g clip-path="url(#__lottie_element_478)">
				<path
					fill="none"
					stroke="currentColor"
					stroke-miterlimit="10"
					stroke-width="40"
					d="M0 260c143.59399414 0 260-116.40600586 260-260S143.59399414-260 0-260-260-143.59399414-260 0-143.59399414 260 0 260z"
					style="display:block"
					transform="matrix(.71108001 0 0 .7111725 256.00000525 256.0060172)"
				/>
				<path
					fill="currentColor"
					d="M256.00000544 305.7592857c51.04728586 0 92.42931366 22.22213804 92.42931366 43.72901773 0 13.71864183-23.1037754-14.43959043-92.42931366-14.43959043-69.32553827 0-92.42931366 28.15823226-92.42931366 14.43959043 0-21.5068797 41.3820278-43.72901773 92.42931366-43.72901773zm21.56589238-74.04227915c.27159996.59581447 3.55639481 2.15857948 4.82054334 1.82156867 6.29941365-1.67865858 20.00596979-18.14885193 36.54868273-25.64984569 15.40583309-6.98552095 36.1924802-7.89986238 42.76206448-11.54584213 1.90049183-1.055117.44295049-8.52056156 0-9.49320507-1.97514325-4.33421887-33.13092626-9.66312625-57.52800122 2.69680788-24.39707226 12.3599287-28.22791216 38.60416765-26.60328933 42.17051634zm-43.13178476 0c-.27159996.59581447-3.55639481 2.15857948-4.82054334 1.82156867-6.29941366-1.67865858-20.0059698-18.14885193-36.54868274-25.64984569-15.40583308-6.98552095-36.1924802-7.89986238-42.76206447-11.54584213-1.90049184-1.055117-.44295049-8.52056156 0-9.49320507 1.97514325-4.33421887 36.9532389-9.93543953 61.35030845 2.4244946 24.3970736 12.35993413 24.40560492 38.87648093 22.7809821 42.44282962zm78.44547002 45.60249033c11.7804717 0 21.3298416-11.14128732 21.3298416-24.88481521 0-13.7435279-9.5493699-24.88481522-21.3298416-24.88481522-11.7804717 0-21.32984162 11.14128733-21.32984162 24.88481522 0 13.7435279 9.54936992 24.88481521 21.32984162 24.88481521zm-113.75915528 0c11.7804717 0 21.32984162-11.14128732 21.32984162-24.88481521 0-13.7435279-9.54936992-24.88481522-21.32984162-24.88481522s-21.32984161 11.14128733-21.32984161 24.88481522c0 13.7435279 9.54936992 24.88481521 21.32984161 24.88481521z"
					style="display:block"
				/>
			</g>
		</svg>
	),
	neutral: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="22"
			height="22"
			style="width:100%;height:100%;transform:translate3d(0,0,0);content-visibility:visible"
			viewBox="0 0 512 512"
		>
			<defs>
				<clipPath id="__lottie_element_72">
					<path d="M0 0h512v512H0z" />
				</clipPath>
			</defs>
			<g clip-path="url(#__lottie_element_72)">
				<path
					fill="none"
					stroke="currentColor"
					stroke-miterlimit="10"
					stroke-width="40"
					d="M0 260c143.59399414 0 260-116.40600586 260-260S143.59399414-260 0-260-260-143.59399414-260 0-143.59399414 260 0 260z"
					style="display:block"
					transform="translate(256.00091417 255.99955426) scale(.71111017)"
				/>
				<g style="display:block">
					<path
						fill="currentColor"
						d="M313.95634222 248.88970871c12.37119323 0 22.39998365-11.14294798 22.39998365-24.88852441 0-13.74557779-10.02879042-24.88852442-22.39998365-24.88852442-12.37119322 0-22.39998364 11.14294663-22.39998364 24.88852442 0 13.74557643 10.02879042 24.88852441 22.39998364 24.88852441zm-115.19991588 0c12.37119051 0 22.39998364-11.14294798 22.39998364-24.88852441 0-13.74557779-10.02879313-24.88852442-22.39998364-24.88852442-12.37119322 0-22.39998365 11.14294663-22.39998365 24.88852442 0 13.74557643 10.02879043 24.88852441 22.39998365 24.88852441z"
					/>
					<path
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-miterlimit="10"
						stroke-width="40"
						d="M248 444.45800781h225"
						transform="matrix(.7111106 0 0 .7111007 .0010159 .00446458)"
					/>
				</g>
			</g>
		</svg>
	),
	doubt: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="22"
			height="22"
			style="width:100%;height:100%;transform:translate3d(0,0,0);content-visibility:visible"
			viewBox="0 0 512 512"
		>
			<defs>
				<clipPath id="__lottie_element_29">
					<path d="M0 0h512v512H0z" />
				</clipPath>
			</defs>
			<g clip-path="url(#__lottie_element_29)">
				<path
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-miterlimit="10"
					stroke-width="40"
					d="M-24.47299957 258.8630066C-16.41699982 259.61499022-8.25300026 260 0 260c0 0 0 0 0 0 143.59399414 0 260-116.40600586 260-260S143.59399414-260 0-260-260-143.59399414-260 0c0 51.25999832 14.83399963 99.05599976 40.44400024 139.32800293"
					style="display:block"
					transform="translate(255.99944592 255.99944592) scale(.71111)"
				/>
				<g style="display:block">
					<path
						fill="currentColor"
						d="M188.30917235 142.21948575c28.56253533-.0001695 52.95739263 21.21036034 53.32369098 30.37460612.23364418 5.8454338-25.28755062-12.74815504-53.85008595-12.74798554-28.5625299.00016949-45.83327162 26.91913439-49.73576594 18.755464-4.32539796-9.04831317 21.69962015-36.3819151 50.2621609-36.38208458z"
					/>
					<path
						fill="none"
						stroke="currentColor"
						stroke-miterlimit="10"
						stroke-width="8"
						d="M2.50999999-31.3199997c40.1659987 0 73.28000093 29.82699967 73.28000093 42.71399975 0 8.22000027-34.84500123-17.92700004-75.01100094-17.92700004-40.16600102 0-65.96599644 37.85299968-70.9950034 26.37300014C-75.79000092 7.11600018-37.65599823-31.31999969 2.51-31.31999969z"
						transform="matrix(.71111226 -.00000422 .02842386 .71112323 187.41452549 164.49188105)"
					/>
					<path
						fill="currentColor"
						d="M323.80507193 155.27348894c28.55324818 2.48947319 45.04899345 16.54615145 44.61531914 25.6755559-.27639034 5.8233919-17.75802656-4.23747869-46.31127416-6.7269522-28.55324677-2.4894737-47.71886154 4.43840407-47.90433971-3.79569247-.22891068-10.15697394 21.04704853-17.64238577 49.60029473-15.15291123z"
					/>
					<path
						fill="none"
						stroke="currentColor"
						stroke-miterlimit="10"
						stroke-width=".6"
						d="M4.19199991-20.39699936c40.01300192 3.50099945 62.4199996 23.26899934 61.2969985 36.105999C64.77300262 23.89800071 40.75500107 9.75.74199998 6.24900006-39.27099991 2.7479999-66.61199952 12.48999976-66.41000366.911c.24900055-14.28299975 30.58900451-24.80900073 70.60200357-21.30799937z"
						transform="matrix(.71111226 -.00000422 .02842386 .71112323 321.4038509 169.77828666)"
					/>
					<path
						fill="currentColor"
						d="M194.73077103 235.3794569c11.78241923-.00006992 20.81795789-12.89492503 20.18220134-28.80061869-.63578485-15.90640167-10.70211503-28.80043406-22.48453426-28.80036414-11.78241922.00006992-20.81798624 12.89421566-20.18220139 28.80061733.63575655 15.90569366 10.70211509 28.80043542 22.48453431 28.8003655zm121.40060017 12.79665645c11.78241923-.00006992 20.81795795-12.89492368 20.1822014-28.80061733-.63575644-15.90569094-10.70211503-28.80043406-22.48453426-28.80036415-11.78241922.00006992-20.81795783 12.8949264-20.18220139 28.80061734.63575655 15.90569365 10.70211504 28.80043406 22.48453426 28.80036414z"
					/>
					<path
						fill="none"
						stroke="currentColor"
						stroke-linejoin="round"
						stroke-width="35.4"
						d="M-104.1269989-122.6060028c-7.20300293 4.89200591-10.34999848 11.85100555-11.29299927 20.35700225l-.2820053 3.63400269c-.10999299 2.08699798-.10799409 3.89199829.0400009 7.0019989l.59400178 9.86899566c1.27400207 19.65800476.6839981 32.4940033-3.63899994 47.30600357l-.91500092 2.99099923c-16.07700348 50.3240013-13.67699432 100.09800148 11.68399811 131.42199897 20.31900024 25.09600068 88.29400444 33.13700104 137.72000313 18.74900055 17.7689991-5.17199707 27.3750019-20.02300262 31.64299965-40.91799926l.7519989-3.97799683c1.71700287-9.89300156 2.24100113-19.69900131 2.34199905-36.15000153l.03700257-14.04200172c.03199768-4.39999962.11699676-7.66799927.27999878-10.2119999l.09300231-1.32899951.73300171-.31099987c3.3829956-1.43700028 6.95599366-2.80400086 10.8939972-4.19100046l17.13400268-5.72099996c28.57299805-9.70000005 42.00900269-21.85100007 42.00900269-48.79899812 0-23.10900497-18.16500855-31.00799942-42.26600647-28.98800278-13.63899994 1.14299775-29.53199768 4.91999817-55.07499695 12.3390007l-22.74700165 6.6759987c-29.9449997 8.663002-38.72699928 9.77500152-48.54800033 5.98900222l-1.30500031-.54100036c-.72700119-.40200043-.81699753-1.23799897-.50999832-7.4109993l.25-4.75200272c.51599884-9.60499954.53499985-14.60300064-.35100174-21.08399582-1.99900055-14.6230011-8.65100098-27.08900451-21.28499985-37.125-11.53900146-9.16500091-32.52200317-11.28800201-47.98899841-.7820053z"
						transform="matrix(.71111226 -.00000422 .02842386 .71112323 184.37024254 385.34905674)"
					/>
					<path
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-miterlimit="10"
						stroke-width="37"
						d="M-92.66799927-6.77299976C-69.6210022-17.0699997-38.73099899-19.47699928 0-13.99100018 38.730999-8.5050001 69.62000275 2.65100002 92.66799927 19.47699928"
						transform="matrix(.71111226 -.00000422 .02842386 .71112323 256.03965243 291.57136027)"
					/>
				</g>
			</g>
		</svg>
	),
	silly: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="22"
			height="22"
			style="width:100%;height:100%;transform:translate3d(0,0,0)"
			viewBox="0 0 512 512"
		>
			<defs>
				<clipPath id="__lottie_element_599">
					<path d="M0 0h512v512H0z" />
				</clipPath>
			</defs>
			<g clip-path="url(#__lottie_element_599)">
				<path
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="40"
					d="M75.22100067 248.95300293C182.1380005 216.69099426 260 117.43900299 260 0c0-143.59399414-116.40600586-260-260-260S-260-143.59399414-260 0c0 123.14299774 85.61000061 226.29100037 200.56000137 253.17399597"
					style="display:block"
					transform="translate(255.99954503 255.9996796) scale(.71111256)"
				/>
				<g style="display:block">
					<path
						fill="currentColor"
						d="M259.55597634 322.67906179c60.87476056 0 110.22368461-32.94336785 110.22368461-5.4521611 0 31.21250721-25.88194603 50.63533435-63.28048367 58.97464855l-.00924491-28.59130815c.00071073-.39822577-.03199912-.79574624-.09742425-1.1889969-.6478276-3.87347261-4.31294785-6.48897498-8.18641775-5.83972049-13.04479655 2.19735988-25.9281679 3.29604525-38.65011403 3.29604525-12.55625518 0-24.9553536-1.0702399-37.19658183-3.21071426-.39396139-.07111097-.79361133-.105953-1.19468273-.10666374-3.92751793-.00498053-7.11547255 3.17515064-7.12045037 7.10266585l.00071073 28.85087106c-38.16797059-8.16010175-64.7126804-27.67751565-64.7126804-59.28682717 0-27.49120675 49.34892404 5.4521611 110.2236846 5.4521611zm32.06869262-107.28462109 64.27036767-33.15173108c2.09424437-1.0801901 4.66779197-.25813602 5.74798208 1.83611377.81636283 1.58224213.56321277 3.50582451-.63360216 4.82424478l-26.8128069 29.52927904c-4.29374187 4.72895-4.90815432 11.74059902-1.50259698 17.14440471l25.01722645 39.69545938c1.25654878 1.9932719.65849398 4.62797346-1.33478334 5.88452225-1.42721077.89956706-3.2505314.87325649-4.65143975-.06613315l-61.50196615-41.24428093c-6.52381973-4.3748139-8.26535488-13.20977541-3.89054098-19.73359515 1.33761811-1.99469334 3.15808769-3.61746878 5.29216006-4.71828362zm-71.24859069 0-64.27036768-33.15173108c-2.09424436-1.0801901-4.66779196-.25813602-5.74798207 1.83611377-.81636283 1.58224213-.56321277 3.50582451.63360215 4.82424478l26.81280691 29.52927904c4.29374186 4.72895 4.90815431 11.74059902 1.50259698 17.14440471L154.2895081 275.2722113c-1.25654879 1.9932719-.65849398 4.62797346 1.33478333 5.88452225 1.42721078.89956706 3.25053141.87325649 4.65143976-.06613315l61.50196614-41.24428093c6.52381974-4.3748139 8.26535489-13.20977541 3.89054099-19.73359515-1.33761812-1.99469334-3.1580877-3.61746878-5.29216006-4.71828362z"
					/>
					<path
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-miterlimit="10"
						stroke-width="23.11141787"
						d="M213.30469539 330.71402625c-6.4064869 2.99950268-10.81614285 9.5539028-10.81614285 17.09249294v49.19247395c0 32.44131854 25.80869745 58.84522517 57.77854435 58.84522517 31.9698469 0 57.77854435-26.40390663 57.77854435-58.84522517v-49.19247395c0-8.04988708-5.02762204-14.97762113-12.14594023-17.65285737"
					/>
				</g>
			</g>
		</svg>
	),
} as const;

function GifSearchItem(props: { video: Video; onSelect: (e: Video | null) => void; SN_ID: string }) {
	const [thumb, setThumb] = createSignal("");
	const [preview, setPreview] = createSignal("");
	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);

	const [height, setHeight] = createSignal(0);

	const [focused, setFocused] = createSignal(false);

	const [progress, setProgress] = createSignal(0);

	// i should probably create a custom hook for this part
	// #region
	let mounted = true;

	onCleanup(() => {
		mounted = false;
	});

	onMount(() => {
		const media = props.video;

		setHeight(clampImageDimension(media.height, media.width, 200, 110).h);

		const thumb = media.getThumbnail(Thumbnail.THUMB_STRIP) || media.thumbnails.find((a) => Number.isNaN(a.width));

		let url!: string;

		if (thumb && "byteLength" in thumb.location) {
			setThumb((url = URL.createObjectURL(new Blob([thumb.location as Uint8Array<ArrayBuffer>]))));
		}

		onCleanup(() => {
			URL.revokeObjectURL(url);
		});
	});

	onMount(() => {
		const media = props.video;

		const thumb = media.thumbnails.find((a) => !Number.isNaN(a.width) && !a.isVideo);

		if (thumb) {
			const download = downloadFile(thumb);

			let url!: string;

			const stateChange = () => {
				if (download.state == "done") {
					if (mounted) {
						setPreview((url = URL.createObjectURL(download.result)));
					}
				}
			};

			if (download.state == "done") {
				stateChange();

				onCleanup(() => {
					URL.revokeObjectURL(url);
				});

				return;
			}

			download.on("state", stateChange);

			function progressChange() {
				// console.error("DOWNLOAD PRESS", download.progress);
				setProgress(download.progress);
			}

			download.on("progress", progressChange);

			onCleanup(() => {
				if (download.state != "done") {
					download.abort();
				}
				download.off("progress", progressChange);
				download.off("state", stateChange);
				URL.revokeObjectURL(url);
			});
		} else {
			console.error("THUMBNAIL NOT FOUND FOR GIF SEARCH ITEM!!!", media, media.fileName);
		}
	});

	onMount(() => {
		const media = props.video.thumbnails.find((a) => a.isVideo) || props.video;

		const fileSize = media.fileSize;

		if (!fileSize) {
			// found memory issue with this lmao
			return;
		}

		// if (props.video != media) {
		// 	console.error("USING VIDEO THUMBNAIL! ", media.fileSize < (props.video.fileSize || 0));
		// }

		console.info("GIF Search Result " + "(" + props.video.fileName + "): " + niceBytes(fileSize));

		if (media.fileSize > 5242880) {
			// console.error("SKIPPING DOWNLOAD BECAUSE FILE SIZE TOO BIG", fileSize, media);
			// todo do to something about this
			// return;
			console.warn("GIF ITEM SHOULD HAVE BEEN SKIPPED BECAUSE OF FILESIZE", niceBytes(fileSize), media);
		}

		const download = downloadFile(media);

		let url!: string;

		const stateChange = () => {
			if (download.state == "done") {
				setProgress(100);

				if (mounted) {
					setLoading(false);
					setSrc((url = URL.createObjectURL(download.result)));
				}
			}
		};

		if (download.state == "done") {
			stateChange();

			onCleanup(() => {
				URL.revokeObjectURL(url);
			});

			return;
		}

		download.on("state", stateChange);

		onCleanup(() => {
			if (download.state != "done") {
				download.abort();
			}
			download.off("state", stateChange);
			URL.revokeObjectURL(url);
		});
	});

	// #endregion

	return (
		<div
			onBlur={() => {
				setFocused(false);
			}}
			onFocus={() => {
				setFocused(true);
			}}
			on:sn-willfocus={(e) => {
				scrollIntoView(e.currentTarget, {
					behavior: "smooth",
					scrollMode: "if-needed",
					inline: "center",
					block: "center",
				});

				setSoftkeys("Cancel", "SELECT", "tg:search");
			}}
			on:sn-enter-down={() => {
				props.onSelect(props.video);
			}}
			tabIndex={-1}
			classList={{ [styles.gif]: true, [props.SN_ID]: true }}
			style={{
				"background-image": preview() ? `url(${preview()})` : undefined,
				height: height() + "px",
			}}
		>
			<Show
				when={preview()}
				fallback={
					<Show when={thumb()} fallback={props.video.fileName || ""}>
						<img class={styles.thumb} src={thumb() + "#-moz-samplesize=2"}></img>
					</Show>
				}
			>
				<img alt={props.video.fileName || undefined} src={preview() + "#-moz-samplesize=2"}></img>
			</Show>
			<Show when={focused() && src()}>
				<video x-puffin-playsinline={cloudphone || undefined} muted autoplay loop src={src()}></video>
			</Show>
			<div class={styles.glass}>
				<Show when={loading()}>
					<ProgressSpinner size={40} progress={progress()} showClose></ProgressSpinner>
				</Show>
			</div>
		</div>
	);
}

function GifSearch(props: { onSelect: (e: Video | null) => void }) {
	const SN_ID = createUniqueId();

	onMount(() => {
		SpatialNavigation.add(SN_ID, {
			selector: `.${SN_ID}, .${styles.search} input`,
			restrict: "self-only",
		});

		setSoftkeys("Cancel", "", "tg:search");

		SpatialNavigation.focus(SN_ID);
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
	});

	const [text, setText] = createSignal("");
	const [result, setResult] = createSignal<GifResult[]>([]);

	const columns = createMemo(() => inColumns(result(), 2));
	const [searchFocused, setSearchFocused] = createSignal(false);

	return (
		<Content>
			<div
				class={styles.search}
				onKeyDown={(e) => {
					if (e.key == "SoftRight") {
						const search = text();
						if (searchFocused() && search) {
							gifPicker.search(search).then(({ results }) => {
								// if text is no longer the same then probably cancelled
								if (search === text()) {
									setResult(results);
								}
							});
						} else {
							document.querySelector<HTMLInputElement>(`.${styles.search} input`)?.focus();
						}
					}

					if (import.meta.env.DEV && e.key == "Backspace") {
						if ("value" in e.target && e.target.value) {
							return;
						}
					}

					if (e.key == "Backspace" || e.key == "SoftLeft") {
						props.onSelect(null);
						e.preventDefault();
					}
				}}
			>
				<Search
					on:sn-willfocus={(e) => {
						scrollIntoView(e.currentTarget, {
							behavior: "smooth",
							scrollMode: "always",
							block: "end",
							inline: "nearest",
						});
					}}
					onFocus={() => {
						setSoftkeys("Cancel", "", "tg:search");
						setSearchFocused(true);
					}}
					onBlur={() => {
						setSearchFocused(false);
					}}
					onKeyDown={(e) => {
						if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
							e.stopImmediatePropagation();
							e.stopPropagation();
						}
					}}
					onInput={(e) => {
						const target = e.currentTarget;
						setText(target.value);

						if (!target.value) {
							setResult([]);
							return;
						}
					}}
					placeholder="Search"
				/>
				<div class={styles.columns}>
					<For each={columns()}>
						{(column) => (
							<Show when={column.length}>
								<div class={styles.column}>
									<For each={column}>
										{(gif) => <GifSearchItem video={gif.video} onSelect={props.onSelect} SN_ID={SN_ID}></GifSearchItem>}
									</For>
								</div>
							</Show>
						)}
					</For>
				</div>
			</div>
		</Content>
	);
}

function GifCategoryItem(props: {
	selected: GifCategories;
	category: GifCategories;
	setSelected: (e: GifCategories) => void;
}) {
	let divRef!: HTMLDivElement;

	createEffect(() => {
		if (props.selected === props.category) {
			scrollIntoView(divRef, {
				inline: "center",
			});
		}
	});

	return (
		<div
			ref={divRef}
			tabIndex={-1}
			onFocus={() => {
				props.setSelected(props.category);

				setSoftkeys("Cancel", "", "tg:search");
			}}
			on:sn-navigatefailed={(e) => {
				const direction = e.detail.direction;

				if (direction == "down") {
					SpatialNavigation.focus("gifs");
				}
			}}
			classList={{ [styles.category]: true, [styles.selected]: props.selected === props.category }}
		>
			{icons[props.category]}
		</div>
	);
}

function GifItem(props: { onSelect: (e: Video | null) => void; video: Video }) {
	const [thumb, setThumb] = createSignal("");
	const [preview, setPreview] = createSignal("");
	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);

	const [focused, setFocused] = createSignal(false);

	const [progress, setProgress] = createSignal(0);

	// i should probably create a custom hook for this part
	// #region
	let mounted = true;

	onCleanup(() => {
		mounted = false;
	});

	onMount(() => {
		const media = props.video;

		const thumb = media.getThumbnail(Thumbnail.THUMB_STRIP);

		let url!: string;

		if (thumb && "byteLength" in thumb.location) {
			setThumb((url = URL.createObjectURL(new Blob([thumb.location as Uint8Array<ArrayBuffer>]))));
		}

		onCleanup(() => {
			URL.revokeObjectURL(url);
		});
	});

	onMount(() => {
		const media = props.video;

		const thumb = media.getThumbnail("m");

		if (thumb) {
			const download = downloadFile(thumb);

			let url!: string;

			const stateChange = () => {
				if (download.state == "done") {
					setProgress(100);

					if (mounted) {
						setPreview((url = URL.createObjectURL(download.result)));
					}
				}
			};

			if (download.state == "done") {
				stateChange();

				onCleanup(() => {
					URL.revokeObjectURL(url);
				});

				return;
			}

			download.on("state", stateChange);

			function progressChange() {
				// console.error("DOWNLOAD PRESS", download.progress);
				setProgress(download.progress);
			}

			download.on("progress", progressChange);

			onCleanup(() => {
				if (download.state != "done") {
					download.abort();
				}
				download.off("progress", progressChange);
				download.off("state", stateChange);
				URL.revokeObjectURL(url);
			});
		}
	});

	onMount(() => {
		const media = props.video.thumbnails.find((a) => a.isVideo) || props.video;

		const fileSize = media.fileSize;

		if (!fileSize) {
			// found memory issue with this lmao
			return;
		}

		if (fileSize > 5242880) {
			console.error("SKIPPING DOWNLOAD BECAUSE GIF FILE SIZE TOO BIG", niceBytes(fileSize), media);
			// todo do to something about this
			return;
		}

		const download = downloadFile(media);

		let url!: string;

		const stateChange = () => {
			if (download.state == "done") {
				if (mounted) {
					setLoading(false);
					setSrc((url = URL.createObjectURL(download.result)));
				}
			}
		};

		if (download.state == "done") {
			stateChange();

			onCleanup(() => {
				URL.revokeObjectURL(url);
			});

			return;
		}

		download.on("state", stateChange);

		onCleanup(() => {
			if (download.state != "done") {
				download.abort();
			}
			download.off("state", stateChange);
			URL.revokeObjectURL(url);
		});
	});

	// #endregion

	return (
		<div
			onFocus={() => {
				setSoftkeys("Cancel", "SELECT", "tg:search");

				setFocused(true);
			}}
			onBlur={() => {
				setFocused(false);
			}}
			on:sn-willfocus={(e) => {
				scrollIntoView(e.currentTarget, {
					behavior: "smooth",
					scrollMode: "if-needed",
					inline: "nearest",
					block: "nearest",
					skipOverflowHiddenElements: false,
				});
			}}
			on:sn-enter-down={() => {
				props.onSelect(props.video);
			}}
			tabIndex={-1}
			classList={{ [styles.gifItem]: true }}
			style={{
				"background-image": preview() ? `url(${preview()})` : undefined,
			}}
		>
			<Show when={preview()} fallback={<img class={styles.thumb} src={thumb() + "#-moz-samplesize=2"}></img>}>
				<img src={preview() + "#-moz-samplesize=2"}></img>
			</Show>
			<Show when={focused() && src()}>
				<video x-puffin-playsinline={cloudphone || undefined} muted autoplay loop src={src()}></video>
			</Show>
			<div class={styles.glass}>
				<Show when={loading()}>
					<ProgressSpinner size={40} progress={progress()} showClose></ProgressSpinner>
				</Show>
			</div>
		</div>
	);
}

const CATEGORIES = Object.keys(icons) as GifCategories[];

export default function GifPicker(props: { onSelect: (e: Video | null) => void }) {
	const [selected, setSelected] = createSignal<GifCategories>("love");
	const [gifs, setGifs] = createSignal<GifResult[]>([]);
	const [showSearch, setShowSearch] = createSignal(false);

	onMount(() => {
		setSoftkeys("Cancel", "", "tg:search");

		SpatialNavigation.add("gif_categories", {
			selector: `.${styles.category}`,
			restrict: "self-only",
			rememberSource: true,
			defaultElement: `.${styles.selected}`,
		});

		SpatialNavigation.add("gifs", {
			selector: `.${styles.gifItem}`,
			restrict: "self-only",
			rememberSource: true,
		});

		SpatialNavigation.focus("gif_categories");
	});

	onCleanup(() => {
		SpatialNavigation.remove("gif_categories");
		SpatialNavigation.remove("gifs");
	});

	createEffect(() => {
		const category = selected();

		let cancelled = false;

		const sym = Symbol();

		Promise.race([
			gifPicker.getCategory(category).then(({ results }) => {
				if (!cancelled) {
					setGifs(results);
				}
			}),
			sym,
		]).then((result) => {
			if (result === sym) setGifs([]);
		});

		onCleanup(() => {
			cancelled = true;
		});
	});

	function forward() {
		setCurrentSlice(6);
		setSelected((selected) => {
			const result = CATEGORIES[Math.min(CATEGORIES.length - 1, CATEGORIES.indexOf(selected) + 1)];

			if (result != selected) {
				sleep(2).then(() => {
					SpatialNavigation.focus("gif_categories");
				});
			}

			return result;
		});
	}

	function backward() {
		setCurrentSlice(6);
		setSelected((selected) => {
			const result = CATEGORIES[Math.max(0, CATEGORIES.indexOf(selected) - 1)];

			if (result != selected) {
				sleep(2).then(() => {
					SpatialNavigation.focus("gif_categories");
				});
			}

			return result;
		});
	}

	let _lastActiveElement: HTMLElement | null = null;

	const [currentSlice, setCurrentSlice] = createSignal(6);

	return (
		<>
			<Options
				onClose={() => {
					props.onSelect(null);
				}}
				title=""
				maxHeight={null}
			>
				<div
					onKeyDown={(e) => {
						if (e.key == "SoftLeft") {
							props.onSelect(null);
						}
						if (e.key == "SoftRight") {
							_lastActiveElement = document.activeElement as HTMLElement;
							setShowSearch(true);
						}
					}}
					class={styles.container}
				>
					<div class={styles.categories}>
						{
							/*@once*/
							CATEGORIES.map((icon) => (
								<GifCategoryItem selected={selected()} setSelected={setSelected} category={icon} />
							))
						}
					</div>
					<div
						class={styles.gifs_container}
						on:sn-navigatefailed={(e) => {
							const direction = e.detail.direction;
							if (direction == "up") {
								SpatialNavigation.focus("gif_categories");
							}

							if (direction == "right") {
								forward();
							}
							if (direction == "left") {
								backward();
							}
						}}
						on:sn-focused={(e) => {
							const target = e.target as HTMLElement;
							const parent = target.parentElement!;
							const children = Array.from(parent.children);
							const index = children.indexOf(target);
							if (index === children.length - 1 || index === children.length - 2) {
								setCurrentSlice((e) => e + 6);
							}
						}}
					>
						<For each={gifs().slice(0, currentSlice())}>
							{(gif) => <GifItem onSelect={props.onSelect} video={gif.video}></GifItem>}
						</For>
					</div>
				</div>
			</Options>
			<Show when={showSearch()}>
				<GifSearch
					onSelect={(e) => {
						if (e) {
							props.onSelect(e);
						} else {
							setShowSearch(false);
							_lastActiveElement?.focus();
						}
					}}
				></GifSearch>
			</Show>
		</>
	);
}
