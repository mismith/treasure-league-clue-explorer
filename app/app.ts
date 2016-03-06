//our root app component
import {Component, Directive, Input, Output, EventEmitter, ElementRef, Pipe, PipeTransform} from 'angular2/core';
import {FirebaseHelper, FirebaseValuePipe, FirebaseLoadedPipe} from './firebase-helper';

function doConfirm(skip) {
	return new Promise((resolve, reject) => {
		if (skip || confirm('Are you sure?')) return resolve();
		return reject();
	});
}

@Component({
	selector: '[avatar]',
	template: `<img [src]="getPhotoUrl(user?.facebookId)" [alt]="'Avatar for ' + user?.name" [width]="size" [height]="size" />`,
	host: {
		'[title]': 'user?.name',
		'[class.avatar]': 'true',
	},
})
class AvatarComponent {
	@Input('avatar') user: Object;
	@Input() size: number = 24;

	getPhotoUrl(facebookId) {
		return `https://graph.facebook.com/v2.1/${facebookId || ''}/picture?type=square`;
	}
}

@Directive({
	selector: '[markdown]',
	host: {
		'[innerHTML]': 'convertToHTML()',
	},
})
class MarkdownDirective {
	@Input() markdown: string = '';

	convertToHTML() {
		return marked(this.markdown).replace(/^\s+|\s+$/g, '');
	}
}

@Pipe({
	name: 'length',
})
class LengthPipe implements PipeTransform {
	transform(values: any) {
		return values ? (typeof values === 'object' ? Object.keys(values).length : values.length) : 0;
	}
}

@Pipe({
	name: 'moment',
})
class MomentPipe implements PipeTransform {
	transform(dateLike: any, [options: Object = {}]) {
		return moment(dateLike, options).toDate();
	}
}

@Pipe({
	name: 'sort',
	pure: false,
})
class SortPipe implements PipeTransform {
	transform(sortable: Array, args: string[]) {
		let key = args[0] || '$id',
			flip = args[1] || false;
		return sortable.sort((a, b) => (a[key] < b[key] ? -1 : 1) * (flip ? -1 : 1));
	}
}


class Hunt {
	constructor(ref, me) {
		this.ref = ref;
		this.me = me;
	}
	create(name) {
		if (!name) throw new Error('Hunt name is required');
		if (!this.me) throw new Error('You must be logged in');

		var huntId = this.ref.child('hunts').push().key(),
			hunt = {
				name: name,
				created: new Date().toISOString(),
			};

		return this.ref.update({
			[`hunts/${huntId}`]: hunt,
			[`users:hunts/${this.me.uid}/${huntId}`]: true,
			[`hunts:users/${huntId}/${this.me.uid}`]: true,
		}).then(nil => huntId);
	}
	delete(huntId) {
		if (!huntId) throw new Error('Hunt ID is required');
		if (!this.me) throw new Error('You must be logged in');

		return this.ref.update({
			[`hunts/${huntId}`]: null,
			[`users:hunts/${this.me.uid}/${huntId}`]: null,
			[`hunts:users/${huntId}/${this.me.uid}`]: null,
		});
	}
}


@Component({
	selector: '[messages]',
	template: `
<ul class="messages">
	<li *ngFor="#message of messages" class="message" [class.mine]="message.creator === user.uid" [class.active]="message.$active">
		<figure [avatar]="getUser(message.creator)"></figure>
		<div class="content">
			<header>
				<timestamp [innerHTML]="message?.created | moment | date:'medium'"></timestamp>
			</header>
			<div (click)="!message.$editing ? (message.$active = ! message.$active) : null">
				<a *ngFor="#attachment of message.attachments" [href]="attachment.src" target="_blank" class="attachment"><img [src]="attachment.src" /></a>
				<div *ngIf="!message.$editing" [markdown]="message.content"></div>
				<div *ngIf="message.$editing" class="editing">
					<textarea [(ngModel)]="message.content"></textarea>
				</div>
			</div>
			<footer *ngIf="message.$editing">
				<button (click)="message.$editing = false; message.content = message.$content">Cancel</button>
				<button (click)="update.next({message: message, event: $event})">Save</button>
			</footer>
			<footer *ngIf="message.creator === user.uid && !message.$editing">
				<button (click)="message.$editing = true; message.$content = message.content">Edit</button>
				<button (click)="delete.next({message: message, event: $event})">Delete</button>
			</footer>
		</div>
	</li>
	<li *ngIf="!messages.length" class="message empty">No comments yet.</li>
</ul>`,
	pipes: [
		MomentPipe,
	],
	directives: [
		AvatarComponent,
		MarkdownDirective,
	],
})
class MessagesComponent {
	@Input() messages: Array;
	@Input() users: Array;
	@Input() user: Object;

	@Output() update: EventEmitter = new EventEmitter();
	@Output() delete: EventEmitter = new EventEmitter();

	getUser(userId) {
		return this.users.find(user => user.$id === userId);
	}
}

@Component({
	selector '[messagesRef]',
	template: `
<loading *ngIf="!(messagesRef | loaded)" class="fill">Loading...</loading>
<div [messages]="messagesRef | value:true" [users]="users" [user]="me" (update)="update($event.message.$id, $event.message.content)" (delete)="delete($event.message.$id, $event.event.shiftKey)">
</div>
<footer>
	<div>
		<textarea [(ngModel)]="typing" (keypress)="isEnter($event) ? create() : null" (paste)="firebaseFileUploader.process($event.clipboardData.items, attachments)"></textarea>
	</div>
	<button class="btn file-upload" [class.active]="attachments.length"><i class="fa fa-photo"></i><input type="file" (change)="attachments = []; firebaseFileUploader.process($event.target.files, attachments);" accept="image/*" multiple /></button>
	<button (click)="create()" class="btn"><i class="fa fa-send"></i></button>
</footer>`,
	host: {
		'[class.messenger]': 'true',
	},
	pipes: [
		FirebaseValuePipe,
		FirebaseLoadedPipe,
	],
	directives: [
		MessagesComponent,
	],
})
class MessengerComponent {
	@Input() messagesRef: Firebase;
	@Input() users: Object;
	@Input() me: Object;

	private typing: string = '';
	private firebaseFileUploader = new FirebaseFileUploader();
	private attachments: Array = [];

	constructor(private el: ElementRef) {}
	ngOnInit() {
		this.messagesRef.once('value', snap => {
			setTimeout(() => {
				this.scrollToBottom();
			});
		});
	}
	scrollToBottom() {
		this.el.nativeElement.firstElementChild.scrollTop = this.el.nativeElement.firstElementChild.scrollHeight;
	}

	isEnter(e) {
		if (e.keyCode === 13 /* enter */ && !e.shiftKey) {
			e.preventDefault();
			return true;
		}
		return false;
	}
	create() {
		if (this.typing || this.attachments.length) {
			this.messagesRef.push({
				created: new Date().toISOString(),
				creator: this.me.uid,
				content: this.typing,
				attachments: this.attachments,
			});

			this.typing = '';
			this.attachments = [];
		}
	}
	update(messageId, content) {
		if (content !== undefined) {
			this.messagesRef.child(messageId).update({
				updated: new Date().toISOString(),
				updator: this.me.uid,
				content: content,
			});
		}
	}
	delete(messageId, skipConfirm) {
		return doConfirm(skipConfirm).then(() => this.messagesRef.child(messageId).remove());
	}
}


@Component({
	selector: '[huntId]',
	template: `
<section *ngIf="me">
	<loading *ngIf="!(data('clues') | loaded)" class="fill">Loading...</loading>
	<article *ngFor="#clue of data('clues') | value:true" (mouseenter)="play(clue)" (mouseleave)="stop(clue)" (touchstart)="play(clue)" (touchend)="stop(clue)" [id]="clue.$id" class="clue {{ active(clue) }}">
		<header>
			<a [href]="'#' + clue.$id" [innerHTML]="clue.num || '#'" class="btn"></a>
			<button (click)="active(clue, 'editing')" class="btn" [class.active]="active(clue) === 'editing'"><i class="fa fa-edit"></i></button>
		</header>
		<aside>
			<figure>
				<img [src]="clue.image.src" />
			</figure>
			<div class="information">
				<div class="fieldset">
					<input [(ngModel)]="clue.num" placeholder="Number" />
					<textarea [(ngModel)]="clue.notes" placeholder="Explanation"></textarea>
					<textarea [(ngModel)]="clue.solution" placeholder="Solution"></textarea>
				</div>
				<footer>
					<button (click)="deleteClue(clue, $event.shiftKey)" class="btn"><i class="fa fa-trash-o"></i></button>
					<button class="btn file-upload" [class.active]="clue.image">
						<i class="fa fa-photo"></i>
						<input type="file" accept="image/*" (change)="firebaseFileUploader.process($event.target.files, clue.image, true)" />
					</button>
					<button class="btn file-upload" [class.active]="clue.audio" (contextmenu)="clue.audio = null">
						<i class="fa fa-volume-up"></i>
						<input type="file" accept="audio/*" (change)="firebaseFileUploader.process($event.target.files, clue.audio = clue.audio || {}, true)" />
					</button>
					<button (click)="updateClue(clue)" class="btn"><i class="fa fa-save"></i></button>
				</footer>
			</div>
			<div class="conversation" [messagesRef]="data('messages', clue.$id)" [users]="firebase.ref('hunts:users', huntId) | value:firebase.ref('users')" [me]="me"></div>
			<div class="resolution">
				<div>
					<h3 *ngIf="clue.notes">Explanation</h3>
					<div [markdown]="clue.notes || ''"></div>
				</div>
				<footer *ngIf="clue.solution" (mouseenter)="clue.$solution = true" (touchstart)="clue.$solution = true" (mouseleave)="clue.$solution = false" (touchend)="clue.$solution = false" [class.hover]="clue.$solution">
					<h3>Solution</h3>
					<div [markdown]="clue.solution"></div>
				</footer>
			</div>
		</aside>
		<footer>
			<button (click)="active(clue, 'conversing')" class="btn" [class.active]="active(clue) === 'conversing'">
				<i class="fa fa-comments"></i>
				<small [innerHTML]="(data('messages', clue.$id) | value | length) || ''"></small>
			</button>
			<button *ngIf="clue.notes || clue.solution" (click)="active(clue, 'resolving')" class="btn" [class.active]="active(clue) === 'resolving'"><i class="fa fa-question-circle"></i></button>
		</footer>
	</article>
	<article *ngIf="data('clues') | loaded" class="clue new file-upload">
		<div>
			Drop Image Here<br /><br />
			<small>or</small><br />
			Click to Upload
		</div>
		<input type="file" accept="image/*" (change)="firebaseFileUploader.process($event.target.files, data('clues').push().child('image'), true)" />
	</article>
</section>
<section *ngIf="!me" class="fill">
	You need to login.
</section>`,
	pipes: [
		FirebaseLoadedPipe,
		FirebaseValuePipe,
		LengthPipe,
	],
	directives: [
		MarkdownDirective,
		MessengerComponent,
	],
})
export class HuntComponent {
	@Input() huntId: string;
	@Input() firebase: FirebaseHelper;
	@Input() me: Object;

	private firebaseFileUploader = new FirebaseFileUploader();

	data(...args) {
		return this.firebase.ref('hunts:data', this.huntId, ...args);
	}

	// clues
	play(clue) {
		if (clue.audio) {
			clue.$audio = clue.$audio || new Audio(clue.audio.src);
			clue.$audio.loop = true;
			clue.$audio.play();
		}
	}
	stop(clue) {
		if (clue.$audio) {
			clue.$audio.pause();
			clue.$audio.currentTime = 0;
		}
	}

	// helper
	active(clue, active) {
		if(active) clue.$active = clue.$active === active ? '' : active;
		return clue.$active || '';
	}

	// CRUD
	updateClue(clue) {
		this.data('clues', clue.$id).update(this.firebase.clean(clue));
	}
	deleteClue(clue, skipConfirm) {
		return doConfirm(skipConfirm).then(() => this.data('clues', clue.$id).remove());
	}
}


@Component({
	selector: '[app]',
	template: `
<header id="header">
	<header>
		<h1><a href="http://treasureleague.com/" target="_blank">Treasure League</a> <span style="white-space: nowrap;">Clue Explorer</span></h1>
	</header>
	<div>
		<label *ngIf="me">
			<small>Hunt:</small>
			<select [(ngModel)]="huntId">
				<option *ngFor="#hunt of firebase.ref('users:hunts', me.uid) | value:firebase.ref('hunts') | sort:'$id':true" [value]="hunt.$id" [innerHTML]="hunt.name"></option>
			</select>
		</label>
		<!--<div *ngIf="me" class="huntList">
			<header>
				<h2>My Hunts</h2>
			</header>
			<ul>
				<li *ngFor="#hunt of firebase.ref('users:hunts', me.uid) | value:firebase.ref('hunts')">
					<header>
						<a (click)="huntId = hunt.$id" [innerHTML]="hunt.name" class="btn" [class.active]="hunt.$id === huntId"></a>
						<button (click)="deleteHunt(hunt.$id, $event.shiftKey)" title="Delete" class="btn"><i class="fa fa-trash-o"></i></button>
					</header>
				</li>
				<li>
					<header>
						<span class="btn">
							<input [(ngModel)]="newHuntName" placeholder="New hunt name" />
						</span>
						<button (click)="createHunt()" title="Create" class="btn"><i class="fa fa-plus"></i></button>
					</header>
				</li>
			</ul>
		</div>-->
	</div>
	<footer>
		<button *ngIf="!me" (click)="firebase.ref().authWithOAuthPopup('facebook')" class="btn">
			<i class="fa fa-facebook"></i>
			Login with Facebook
		</button>
		<button *ngIf="me" (click)="firebase.ref().unauth()" class="btn">
			<figure [avatar]="me"></figure>
			Logout
		</button>
	</footer>
</header>
<div id="frame">
	<aside *ngIf="huntId" id="sidebar">
		<section class="huntDetail">
			<h3>Participants</h3>
			<ul class="users">
				<li *ngFor="#user of firebase.ref('hunts:users', huntId) | value:firebase.ref('users')" class="user">
					<header>
						<figure [avatar]="user"></figure>
						<span [innerHTML]="user.name"></span>
					</header>
				</li>
			</ul>
		</section>
		<section *ngIf="huntId" class="huntComments">
			<h3>Comments</h3>
			<div [messagesRef]="firebase.ref('hunts:data', huntId, 'messages', huntId)" [users]="firebase.ref('hunts:users', huntId) | value:firebase.ref('users')" [me]="me"></div>
		</section>
	</aside>
	<main id="main" [huntId]="huntId" [firebase]="firebase" [me]="me"></main>
</div>`,
	pipes: [
		FirebaseValuePipe,
		FirebaseLoadedPipe,
		SortPipe,
	],
	directives: [
		HuntComponent,
		AvatarComponent,
		MessengerComponent,
	],
})
export class App {
	private me: Object;
	private huntId: string;

	constructor() {
		// public
		this.firebase = new FirebaseHelper('https://treasure-league.firebaseio.com');

		// authed
		this.firebase.ref().onAuth(authData => {
			if (authData) {
				this.me = {
					name: authData.facebook.displayName,
					facebookId: authData.facebook.id,
					uid: authData.uid,
				};

				// update user data
				this.firebase.ref('users', this.me.uid).set(this.me);

				// auto-pick huntId
				this.firebase.ref('users:data', this.me.uid).once('value').then(snap => {
					let userData = snap.val();
					if (userData && userData.huntId) {
						// load the hunt the user was last looking at
						this.huntId = userData.huntId;
					} else {
						// auto-set huntId to user's latest hunt
						this.firebase.ref('users:hunts', this.me.uid).limitToLast(1).once('child_added').then(snap => this.huntId = snap.key());
					}
				});
			} else {
				this.me = null;
				this.huntId = null;
			}
		});
	}

	// CRUD
	createHunt() {
		return new Hunt(this.firebase.ref(), this.me).create(this.newHuntName).then(huntId => {
			this.newHuntName = '';
			this.huntId = huntId;
		}
	}
	deleteHunt(huntId, skipConfirm) {
		return doConfirm(skipConfirm).then(() => new Hunt(this.firebase.ref(), this.me).delete(huntId));
	}
}

