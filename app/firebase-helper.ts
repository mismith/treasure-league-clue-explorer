
import {Pipe, PipeTransform, ChangeDetectorRef, ChangeDetectionStrategy} from 'angular2/core';


export class FirebaseHelper {
	public url: string;
	private root: Firebase;
	private cache: object = {};
	private snaps: object = {};

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
		let out = {};
		for(let k in obj) {
			if (obj && !k.match(/[\.\#\$\/\[\]]/)) out[k] = obj[k];
		}
		return out;
	}

	// snapshot(obj: object) {
	// 	if (!obj || !obj.$id) throw new Error('Cannot take a snapshot of this object');

	// 	return this.snaps[obj.$id] = Object.assign({}, obj);
	// }
	// revert(obj: object) {
	// 	if (!obj || !obj.$id || !this.snaps[obj.$id]) throw new Error('Cannot revert to a snapshot of this object');

	// 	let snap = this.snaps[obj.$id];
	// 	for(let k in obj) if (snap[k] === undefined) delete obj[k]; // remove any added props
	// 	for (k in snap) obj[k] = snap[k]; // restore all other props

	// 	return obj;
	// }
}



@Pipe({
	name: 'value',
	pure: false,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirebaseValuePipe implements PipeTransform {
	private lastValue: any;

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
				this.changeDetectorRef.markForCheck();

				this.nearRef.on('value', snap => {
					this.lastValue = snap.val();

					this.changeDetectorRef.markForCheck();
				});
			}
		} else if (farRef === true) {
			// array of child object values
			if (this.nearRef !== nearRef) {
				if (this.nearRef) this.nearRef.off();
				this.nearRef = nearRef;

				this.lastValue = [];
				this.changeDetectorRef.markForCheck();

				nearRef.on('child_added', nearSnap => {
					let child = nearSnap.val();
					child.$id = nearSnap.key();

					this.lastValue.push(child);

					this.changeDetectorRef.markForCheck();
				});
				nearRef.on('child_changed', nearSnap => {
					let key = nearSnap.key();
					let child = this.lastValue.find(val => val.$id === key);
					let index = this.lastValue.indexOf(child);
					child = nearSnap.val();
					child.$id = key;
					this.lastValue.splice(index, 1, child);

					this.changeDetectorRef.markForCheck();
				});
				nearRef.on('child_removed', nearSnap => {
					let key = nearSnap.key();
					let child = this.lastValue.find(val => val.$id === key);
					let index = this.lastValue.indexOf(child);
					this.lastValue.splice(index, 1);

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
				this.changeDetectorRef.markForCheck();

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
		return this.lastValue;
	}
	ngOnDestroy() {
		if (this.nearRef) this.nearRef.off();
		if (this.farRef) {
			for (let key in this.lastValue) {
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