
import {Pipe, PipeTransform, ChangeDetectorRef, ChangeDetectionStrategy} from 'angular2/core';


export class FirebaseHelper {
	public url: string;
	private root: Firebase;
	private cache: Object = {};
	private snaps: Object = {};

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

	clean(obj: Object) {
		let out = {};
		for(let k in obj) {
			if (obj && !k.match(/[\.\#\$\/\[\]]/)) out[k] = obj[k];
		}
		return out;
	}

	// snapshot(obj: Object) {
	// 	if (!obj || !obj.$id) throw new Error('Cannot take a snapshot of this object');

	// 	return this.snaps[obj.$id] = Object.assign({}, obj);
	// }
	// revert(obj: Object) {
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

	onNearValue(nearSnap) {
		this.lastValue = nearSnap.val();

		this.changeDetectorRef.markForCheck();
	}

	onNearChildAdded(nearSnap) {
		let child = nearSnap.val();
		if (typeof child === 'object') child.$id = nearSnap.key();

		this.lastValue = this.lastValue || [];
		this.lastValue.push(child);

		this.changeDetectorRef.markForCheck();
	}
	onNearChildChanged(nearSnap) {
		let key = nearSnap.key(),
			index = this.indexOf(key),
			child = nearSnap.val();
		if (typeof child === 'object') child.$id = key;

		this.lastValue.splice(index, 1, child);

		this.changeDetectorRef.markForCheck();
	}
	onNearChildRemoved(nearSnap) {
		let key = nearSnap.key(),
			index = this.indexOf(key);

		this.lastValue.splice(index, 1);

		this.changeDetectorRef.markForCheck();
	}

	onFarValue(farSnap) {
		let key   = farSnap.key(),
			index = this.indexOf(key),
			child = farSnap.val();
		if (typeof child === 'object') child.$id = key;

		// sync locally
		if (index >= 0) {
			// update
			this.lastValue.splice(index, 1, child);
		} else {
			// append
			this.lastValue = this.lastValue || [];
			this.lastValue.push(child);
		}

		this.changeDetectorRef.markForCheck();
	}
	onNearFarChildAdded(nearSnap) {
		// hook
		let key = nearSnap.key();
		this.farRef.child(key).on('value', this.onFarValue, this);
	}
	onNearFarChildRemoved(nearSnap) {
		// clean up hooks
		let key = nearSnap.key();
		this.farRef.child(key).off('value', this.onFarValue, this);

		// remove locally
		let index = this.indexOf(key);
		this.lastValue.splice(index, 1);

		this.changeDetectorRef.markForCheck();
	}

	indexOf($id) {
		if (!this.lastValue) return -1;
		let child = this.lastValue.find(val => val.$id === $id);
		return this.lastValue.indexOf(child);
	}

	transform(nearRef: Firebase, [farRef: Firebase]) {
		if (!nearRef) return nearRef;
		if (!farRef) {
			// value of reference
			if (this.nearRef !== nearRef) {
				// input changed, clean up hooks
				if (this.nearRef) {
					this.nearRef.off('value', this.onNearValue, this);
				}
				this.nearRef = nearRef;

				// reset
				this.lastValue = undefined;
				this.changeDetectorRef.markForCheck();

				// hook
				this.nearRef.on('value', this.onNearValue, this);
			}
		} else if (farRef === true) {
			// array of child object values
			if (this.nearRef !== nearRef) {
				// input changed, clean up hooks
				if (this.nearRef) {
					this.nearRef.off('child_added', this.onNearChildAdded, this);
					this.nearRef.off('child_changed', this.onNearChildChanged, this);
					this.nearRef.off('child_removed', this.onNearChildRemoved, this);
				}
				this.nearRef = nearRef;

				// reset
				this.lastValue = undefined;
				this.changeDetectorRef.markForCheck();

				// hook
				this.nearRef.on('child_added', this.onNearChildAdded, this);
				this.nearRef.on('child_changed', this.onNearChildChanged, this);
				this.nearRef.on('child_removed', this.onNearChildRemoved, this);
			}
		} else {
			// values of key-linked references
			if (this.farRef !== farRef) {
				// input changed, clean up hooks
				if (this.lastValue && this.lastValue.length) {
					this.lastValue.map(child => {
						this.farRef.child(child.$id).off('value', this.onFarValue, this);
					});
				}
				this.farRef = farRef;
			}
			if (this.nearRef !== nearRef) {
				// input changed, clean up hooks
				if (this.nearRef) {
					this.nearRef.off('child_added', this.onNearFarChildAdded, this);
					this.nearRef.off('child_removed', this.onNearFarChildRemoved, this);
				}
				this.nearRef = nearRef;

				// reset
				this.lastValue = undefined;
				this.changeDetectorRef.markForCheck();

				// hook
				this.nearRef.on('child_added', this.onNearFarChildAdded, this);
				this.nearRef.on('child_removed', this.onNearFarChildRemoved, this);
			}
		}
		return this.lastValue;
	}
	ngOnDestroy() {
		// @TODO: clean up all hooks
	}
}



@Pipe({
	name: 'child',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirebaseChildPipe implements PipeTransform {
	private nearRef: Firebase;
	private child: Firebase;
	private path: string;

	transform(nearRef: Firebase, args: any[]) {
		if (this.nearRef !== nearRef) {
			this.nearRef = nearRef;
		}
		let path = args.join('/');
		if (this.path !== path) {
			this.path = path;
			this.child = this.nearRef.child(this.path);
		}
		return this.child;
	}
}



@Pipe({
	name: 'loaded',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirebaseLoadedPipe implements PipeTransform {
	transform(nearRef: Firebase) {
		return nearRef.once('value');
	}
}



// @Pipe({
// 	name: 'array',
// 	pure: false,
// 	changeDetection: ChangeDetectionStrategy.OnPush,
// })
// export class FirebaseArrayPipe implements PipeTransform {
// 	private arr: Array = [];

// 	transform(obj: Object, args: string[]) {
// 		this.arr.length = 0; // clear existing array

// 		for (let k in obj) {
// 			let item = obj[k];
// 			item[args[0] || '$id'] = k;
// 			this.arr.push(item);
// 		}

// 		return this.arr;
// 	}
// }