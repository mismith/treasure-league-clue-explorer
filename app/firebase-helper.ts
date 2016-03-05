
import {Pipe, PipeTransform, ChangeDetectorRef, ChangeDetectionStrategy} from 'angular2/core';


export class FirebaseHelper {
	public url: string;
	private root: Firebase;
	private cache: object = {};

	constructor(public url: string) {
		if (this.url) this.root = new Firebase(this.url);
	}
	ref(...paths: string[]) {
		let path = paths.join('/');
		if (!this.cache[path]) {
			this.cache[path] = this.root ? (path ? this.root.child(path) : this.root) : new Firebase(path);
		}
		return this.cache[path];
	}
	clean(obj: object) {
		var out = {};
		for(let k in obj) {
			if (obj && !k.match(/[\.\#\$\/\[\]]/)) out[k] = obj[k];
		}
		return out;
	}
}



@Pipe({
	name: 'value',
	pure: false,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirebaseValuePipe implements PipeTransform {
	private lastValue: any;
	private lastReturnedValue: any;

	private nearRef: Firebase;
	private farRef: Firebase;

	constructor(private changeDetectorRef: ChangeDetectorRef) {}
	transform(nearRef: Firebase, [farRef: Firebase]) {
		if (!farRef) {
			// value of reference

			if (this.nearRef !== nearRef) {
				if (this.nearRef) this.nearRef.off();
				this.nearRef = nearRef;

				this.lastValue = undefined;

				this.nearRef.on('value', snap => {
					this.lastValue = snap.val();

					this.changeDetectorRef.markForCheck();
				});
			}
		} else {
			// values of key-linked references
			if (this.farRef !== farRef) {
				for (let key in this.obj) {
					this.farRef.child(key).off();
				}
				this.farRef = farRef;
			}
			if (this.nearRef !== nearRef) {
				if (this.nearRef) this.nearRef.off();
				this.nearRef = nearRef;

				this.lastValue = {};

				nearRef.on('child_added', nearSnap => {
					let key = nearSnap.key();
					this.farRef.child(key).on('value', farSnap => {
						this.lastValue[key] = farSnap.val();

						this.changeDetectorRef.markForCheck();
					});
				});
				nearRef.on('child_removed', nearSnap => {
					let key = nearSnap.key();
					this.farRef.child(key).off('value');
					delete this.lastValue[key];

					this.changeDetectorRef.markForCheck();
				});
			}
		}

		if (this.lastReturnedValue !== this.lastValue) {
			// new value, store it for next check
			this.lastReturnedValue = this.lastValue;
		} // else: nothing changed
		return this.lastReturnedValue;
	}
	ngOnDestroy() {
		if (this.nearRef) this.nearRef.off();
		if (this.farRef) {
			for (let key in this.obj) {
				this.farRef.child(key).off();
			}
		}
	}
}



@Pipe({
	name: 'array',
	pure: false,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirebaseArrayPipe implements PipeTransform {
	private arr: array = [];

	transform(obj: object, args: string[]) {
		this.arr.length = 0; // clear existing array

		for (let k in obj) {
			let item = obj[k];
			item[args[0] || '$id'] = k;
			this.arr.push(item);
		}

		return this.arr;
	}
}