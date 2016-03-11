//our root app component
import {Component, Directive, Input, Output, EventEmitter, ElementRef, Pipe, PipeTransform} from 'angular2/core';
import {URLSearchParams} from 'angular2/http';
//import {RouteConfig, RouterLink, RouterOutlet, Router, RouterParams} from 'angular2/router';
import {FirebaseHelper, FirebaseValuePipe, FirebaseLoadedPipe, FirebaseChildPipe} from './firebase-helper';

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
	selector: 'textarea,input',
	host: {
		'(keypress)': 'onKeypress($event)',
	},
})
class EnterpressDirective {
	@Output() enterpress: EventEmitter = new EventEmitter();

	onKeypress(e) {
		if (e.keyCode === 13 /* enter */ && !e.shiftKey) {
			e.preventDefault();
			this.enterpress.next(e);
		}
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
	transform(dateLike: any, args: any[]) {
		return moment(dateLike).format(args[0] || 'ddd, MMM D, YYYY @ h:mm:ssa');
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
		return sortable && sortable.sort ? sortable.sort((a, b) => (a && b && a[key] < b[key] ? -1 : 1) * (flip ? -1 : 1)) : sortable;
	}
}


@Component({
	selector: '[reactionsRef]',
	template: `
<ul class="reactions">
	<li *ngFor="#reaction of reactionTypes" [title]="caption(reaction.$id)" class="reaction">
		<button (click)="toggle(reaction.$id)" [class.active]="reacted[reaction.$id]"><i class="fa fa-{{ reaction.icon }}"></i></button>
		<small [innerHTML]="(reactions[reaction.$id] | length) || ''"></small>
	</li>
</ul>`,
	pipes: [
		FirebaseValuePipe,
		LengthPipe,
	],
})
class ReactionsComponent {
	@Input() reactionsRef: Firebase;
	@Input() users: Array;
	@Input() me: Object;

	private reactionTypes = [
		{
			$id: 'like',
			name: 'Like',
			icon: 'thumbs-up',
		},
		// {
		// 	$id: 'dislike',
		// 	name: 'Dislike',
		// 	icon: 'thumbs-down',
		// },
	];
	private reactions = {};
	private reacted = {};

	ngOnInit() {
		this.reactionTypes.forEach(reaction => {
			this.reactionsRef.child(reaction.$id).on('value', snap => {
				let reactions = snap.val();
				this.reactions[reaction.$id] = reactions;
				this.reacted[reaction.$id] = reactions ? reactions[this.me.uid] : false;
			});
		});
	}

	getUser(userId) {
		return this.users ? this.users.find(user => user.$id === userId) : {};
	}
	getReactionType(reactionId) {
		return this.reactionTypes ? this.reactionTypes.find(reactionType => reactionType.$id === reactionId) : {};
	}

	caption(reactionId) {
		if (this.reactions[reactionId]) {
			var userNames = Object.keys(this.reactions[reactionId]).map(
				userId => this.getUser(userId).name
			);
			return this.getReactionType(reactionId).name + ':\n' + userNames.join('\n');
		} else {
			return this.getReactionType(reactionId).name;
		}
	}
	toggle(reactionId) {
		return this.reactionsRef.child(reactionId).child(this.me.uid).once('value').then(snap => {
			return snap.ref().set(snap.val() ? null : new Date().toISOString());
		});
	}
}

@Component({
	selector: '[messages]',
	template: `
<ul class="messages">
	<li *ngFor="#message of messages; #i = index" class="message" [ngClass]="{mine: message.creator === me.uid, active: message.$active, continued: messages[i + (message.creator === me.uid ? 1 : -1)]?.creator === message.creator}">
		<header>
			<timestamp [innerHTML]="message.created | moment"></timestamp>
		</header>
		<div class="content">
			<figure [avatar]="getUser(message.creator)"></figure>
			<div (click)="!message.$editing ? (message.$active = ! message.$active) : null" [class.editing]="message.$editing">
				<a *ngFor="#attachment of message.attachments" [href]="attachment.src" target="_blank" class="attachment"><img [src]="attachment.src" /></a>
				<div *ngIf="!message.$editing" [markdown]="message.content"></div>
				<textarea *ngIf="message.$editing" [(ngModel)]="message.content" (enterpress)="updated.next({message: message, event: $event})"></textarea>
			</div>
			<aside class="extra" [reactionsRef]="reactionsRef | child:message.$id" [users]="users" [me]="me"></aside>
		</div>
		<footer *ngIf="message.creator === me.uid && !message.$editing">
			<button (click)="message.$editing = true; message.$content = message.content">Edit</button>
			<button (click)="deleted.next({message: message, event: $event})">Delete</button>
		</footer>
		<footer *ngIf="message.$editing">
			<button (click)="message.$editing = false; message.content = message.$content">Cancel</button>
			<button (click)="updated.next({message: message, event: $event})">Save</button>
		</footer>
	</li>
	<li *ngIf="!(messages | length)" class="message empty">No comments yet.</li>
</ul>`,
	pipes: [
		MomentPipe,
		FirebaseChildPipe,
		LengthPipe,
	],
	directives: [
		AvatarComponent,
		MarkdownDirective,
		ReactionsComponent,
		EnterpressDirective,
	],
})
class MessagesComponent {
	@Input() messages: Array;
	@Input() users: Array;
	@Input() me: Object;
	@Input() reactionsRef: Firebase;

	@Output() updated: EventEmitter = new EventEmitter();
	@Output() deleted: EventEmitter = new EventEmitter();

	getUser(userId) {
		return this.users && this.users.find(user => user.$id === userId);
	}
}

@Component({
	selector '[messagesRef]',
	template: `
<div [messages]="messagesRef | value:true" [users]="users" [me]="me" [reactionsRef]="reactionsRef" (updated)="update($event.message)" (deleted)="delete($event.message, $event.event.shiftKey)">
</div>
<footer>
	<div>
		<textarea [(ngModel)]="newMessageContent" (enterpress)="create()" (paste)="firebaseFileUploader.process($event.clipboardData.items, attachments)"></textarea>
	</div>
	<button (contextmenu)="attachments.length = 0" title="Attach Photo(s)" class="btn no-grow file-upload" [class.active]="attachments.length"><i class="fa fa-photo"></i><input type="file" (change)="attachments = []; firebaseFileUploader.process($event.target.files, attachments);" accept="image/*" multiple /></button>
	<button (click)="create()" title="Send" class="btn no-grow"><i class="fa fa-arrow-circle-right"></i></button>
</footer>`,
	host: {
		'[class.messenger]': 'true',
		'[class.loading]': '!(messagesRef | loaded | async)',
	},
	pipes: [
		FirebaseValuePipe,
		FirebaseLoadedPipe,
	],
	directives: [
		MessagesComponent,
		EnterpressDirective,
	],
})
class MessengerComponent {
	@Input() messagesRef: Firebase;
	@Input() users: Object;
	@Input() me: Object;
	@Input() reactionsRef: Firebase;

	@Output() created: EventEmitter = new EventEmitter();
	@Output() updated: EventEmitter = new EventEmitter();
	@Output() deleted: EventEmitter = new EventEmitter();

	private newMessageContent: string = '';
	private firebaseFileUploader = new FirebaseFileUploader();
	private attachments: Array = [];

	// scrolling
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

	// messages
	create() {
		if (this.newMessageContent || this.attachments.length) {
			var message = {
				created: new Date().toISOString(),
				creator: this.me.uid,
				content: this.newMessageContent,
				attachments: this.attachments,
			};
			return this.messagesRef.push(message)
				.then(ref => {
					this.newMessageContent = '';
					this.attachments = [];

					this.created.next(message);
				});
		}
	}
	update(message) {
		if (message.$id && message.content) {
			message.updated = new Date().toISOString();
			message.updator = this.me.uid;
			return this.messagesRef.child(message.$id).update(new FirebaseHelper().clean(message))
				.then(() => this.updated.next(message));
		}
	}
	delete(message, skipConfirm) {
		if (message.$id) {
			return doConfirm(skipConfirm)
				.then(() => this.messagesRef.child(message.$id).remove())
				.then(() => this.deleted.next(message));
		}
	}
}


@Component({
	selector: '[huntId]',
	template: `
<aside *ngIf="huntId" id="sidebar" [class.active]="isHash('participants') || isHash('comments')">
	<section class="huntDetail" [class.active]="isHash('participants')">
		<header>
			<h3>Participants</h3>
			<button (click)="invite()" title="Invite Friends" class="btn"><i class="fa fa-user-plus"></i></button>
		</header>
		<ul class="users" [class.loading]="!(data('users') | value:firebase.ref('users') | length)">
			<li *ngFor="#user of data('users') | value:firebase.ref('users')" class="user">
				<header>
					<figure [avatar]="user"></figure>
					<span [innerHTML]="user.name"></span>
				</header>
			</li>
		</ul>
	</section>
	<section (click)="see('conversation')" class="huntComments" [class.active]="isHash('comments')">
		<header>
			<h3 [class.highlight]="unseen('conversation') | value">Comments</h3>
		</header>
		<div [messagesRef]="data('messages', huntId)" [users]="data('users') | value:firebase.ref('users')" [me]="me" [reactionsRef]="data('reactions', huntId)" (created)="unsee('conversation')"></div>
	</section>
</aside>
<main id="main" [class.loading]="!(data('clues') | loaded | async)">
	<article *ngFor="#clue of data('clues') | value:true" (mouseenter)="play(clue)" (mouseleave)="stop(clue)" (touchstart)="play(clue)" (touchend)="stop(clue)" (click)="see('clues', clue.$id, 'information')" [id]="clue.$id" class="clue {{ tab(clue) }} {{ isHash(clue.$id) ? 'active' : '' }}">
		<header>
			<a [href]="'#' + clue.$id" [innerHTML]="clue.num || '#'" class="btn no-grow" [class.highlight]="unseen('clues', clue.$id, 'information') | value"></a>
			<button (click)="tab(clue, 'conversation')" title="Comments" class="btn"  [ngClass]="{active: tab(clue) === 'conversation', highlight: unseen('clues', clue.$id, 'conversation') | value}">
				<i class="fa fa-comments"></i>
				<small [innerHTML]="(data('messages', clue.$id) | value | length) || ''"></small>
			</button>
			<button *ngIf="clue.notes || clue.solution" (click)="tab(clue, 'resolution')" title="Resolution" class="btn" [ngClass]="{active: tab(clue) === 'resolution', highlight: unseen('clues', clue.$id, 'resolution') | value}"><i class="fa fa-question-circle"></i></button>
			<button (click)="tab(clue, 'information')" title="Edit" class="btn no-grow" [class.active]="tab(clue) === 'information'"><i class="fa fa-edit"></i></button>
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
					<button (click)="deleteClue(clue, $event.shiftKey)" title="Delete" class="btn"><i class="fa fa-trash-o"></i></button>
					<button title="Upload Photo" class="btn file-upload" [class.active]="clue.image">
						<i class="fa fa-photo"></i>
						<input type="file" accept="image/*" (change)="firebaseFileUploader.process($event.target.files, clue.image, true)" />
					</button>
					<button title="Upload Audio" class="btn file-upload" [class.active]="clue.audio" (contextmenu)="clue.audio = null">
						<i class="fa fa-volume-up"></i>
						<input type="file" accept="audio/*" (change)="firebaseFileUploader.process($event.target.files, clue.audio = clue.audio || {}, true)" />
					</button>
					<button (click)="updateClue(clue)" title="Save" class="btn"><i class="fa fa-save"></i></button>
				</footer>
			</div>
			<div class="conversation" [messagesRef]="data('messages', clue.$id)" [users]="data('users') | value:firebase.ref('users')" [me]="me" [reactionsRef]="data('reactions')" (created)="unsee('clues', clue.$id, 'conversation')"></div>
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
	</article>
	<article class="clue new file-upload">
		<div>
			Drop Image Here<br /><br />
			<small>or</small><br />
			Click to Upload
		</div>
		<input type="file" accept="image/*" (change)="createClue($event.target.files)" />
	</article>
</main>
<nav id="nav">
	<a (click)="hash('participants')" [class.active]="isHash('participants')"><i class="fa fa-user"></i></a>
	<div>
		<a *ngFor="#clue of data('clues') | value:true" (click)="hash(clue.$id)" [class.active]="isHash(clue.$id)" [innerHTML]="clue.num"></a>
	</div>
	<a (click)="hash('comments')" [class.active]="isHash('comments')"><i class="fa fa-comments"></i></a>
</nav>`,
	host: {
		'[class.loading]': `!(firebase.ref('hunts', huntId) | loaded | async)`,
	},
	pipes: [
		FirebaseLoadedPipe,
		FirebaseValuePipe,
		LengthPipe,
	],
	directives: [
		AvatarComponent,
		MarkdownDirective,
		MessengerComponent,
	],
})
export class HuntComponent {
	@Input() huntId: string;
	@Input() firebase: FirebaseHelper;
	@Input() me: Object;

	private firebaseFileUploader = new FirebaseFileUploader();
	private $hash: string = location.hash.substr(1) || 'comments';

	constructor() {
		window.addEventListener('hashchange', e => this.hash(location.hash.substr(1)));
	}

	// helpers
	data(...paths: string[]) {
		return this.firebase.ref('hunts:data', this.huntId, ...paths);
	}
	tab(clue, set) {
		if (set) {
			clue.$active = clue.$active === set ? '' : set;

			// mark as seen, if applicable
			if (clue.$active) {
				this.see('clues', clue.$id, clue.$active);
			}
		}
		return clue.$active || '';
	}
	hash(set) {
		if (set) this.$hash = set;
		return this.$hash;
	}
	isHash(hash) {
		return hash === this.$hash;
	}

	unsee(...paths: string[]) {
		this.data('users').once('value').then(usersSnap => {
			usersSnap.forEach(userSnap => {
				var userId = userSnap.key();
				if (userId !== this.me.uid) {
					this.firebase.ref('users:unseen', userId, 'hunts', this.huntId, ...paths).set(true);
				}
			});
		});
	}
	unseen(...paths: string[]) {
		return this.firebase.ref('users:unseen', this.me.uid, 'hunts', this.huntId, ...paths);
	}
	see(...paths: string[]) {
		return this.firebase.ref('users:unseen', this.me.uid, 'hunts', this.huntId, ...paths).remove();
	}

	// clues
	createClue(fileList) {
		return this.firebaseFileUploader.process(fileList)
			.then(attachments => {
				return this.data('clues').push({
					image: attachments[0],
				});
			})
			.then(clueRef => {
				return this.unsee('clues', clueRef.key(), 'information');
			});
	}
	updateClue(clue) {
		return this.data('clues', clue.$id).update(this.firebase.clean(clue))
			.then(() => {
				return this.unsee('clues', clue.$id, 'resolution');
			});
	}
	deleteClue(clue, skipConfirm) {
		return doConfirm(skipConfirm).then(() => this.data('clues', clue.$id).remove());
	}
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

	// hunt
	invite() {
		// init Facebook
		FB.init({
			appId: '238023659868967',
		});

		// create invite
		this.firebase.ref('invites').push({
			huntId: this.huntId,
			creator: this.me.uid,
			created: new Date().toISOString(),
		}).then(snap => {
			// open dialog
			FB.ui({
				method: 'send',
				link: 'http://mismith.github.io/treasure-league-clue-explorer/?inviteId=' + snap.key(),
			}, res => {
				if (!res) {
					// remove the invite if the user cancels
					this.firebase.ref('invites', snap.key()).remove();
				} else {
					// if successful, link this invite to the current user
					this.firebase.ref('users:data', this.me.uid, 'invites', snap.key()).set(true);
				}
			});
		});
	}
}


@Component({
	selector: '[app]',
	template: `
<header id="header">
	<header>
		<h1><a href="http://treasureleague.com/" target="_blank">Treasure League</a> <span style="white-space: nowrap;">Clue Explorer</span></h1>
	</header>
	<div *ngIf="me" (click)="$event.stopPropagation()" class="dropdown">
		<button (click)="dropdown = dropdown === 'hunts' ? '' : 'hunts'" class="btn">
			<span [innerHTML]="(firebase.ref('hunts', huntId) | value)?.name || 'My Hunts'"></span>
			<i class="fa fa-caret-down"></i>
		</button>
		<div class="dropdown-menu" [class.active]="dropdown === 'hunts'">
			<ul id="huntList">
				<li *ngFor="#hunt of firebase.ref('users:data', me.uid, 'hunts') | value:firebase.ref('hunts') | sort:'$id':true">
					<header>
						<a *ngIf="!hunt.$editing" (click)="huntId = hunt.$id" [innerHTML]="hunt.name" class="btn" [class.active]="hunt.$id === huntId"></a>
						<label *ngIf="hunt.$editing" class="btn">
							<input [(ngModel)]="hunt.name" (enterpress)="updateHunt(hunt)" placeholder="Hunt name" />
						</label>
						<button *ngIf="hunt.$editing" (click)="updateHunt(hunt)" title="Save" class="btn"><i class="fa fa-save"></i></button>
						<button *ngIf="hunt.$editing" (click)="deleteHunt(hunt, $event.shiftKey)" title="Delete" class="btn"><i class="fa fa-trash-o"></i></button>
						<button (click)="hunt.$editing = ! hunt.$editing" title="Edit" class="btn" [class.active]="hunt.$editing"><i class="fa fa-edit"></i></button>
					</header>
				</li>
				<li>
					<header>
						<label class="btn">
							<input [(ngModel)]="newHuntName" (enterpress)="createHunt()" placeholder="New hunt name" />
						</label>
						<button (click)="createHunt()" title="Create" class="btn"><i class="fa fa-plus"></i></button>
					</header>
				</li>
			</ul>
		</div>
	</div>
	<footer>
		<button *ngIf="me" (click)="firebase.ref().unauth()" class="btn">
			<figure [avatar]="me"></figure>
			<span>Logout</span>
		</button>
	</footer>
</header>
<div id="body">
	<section *ngIf="me && huntId" id="hunt" [huntId]="huntId" [firebase]="firebase" [me]="me" class="loading"></section>
	<section *ngIf="me && !huntId" id="hunt" class="fill">
		<p>Pick or create a hunt using the <strong>My Hunts</strong> menu above.</p>
	</section>
	<section *ngIf="!me" class="fill">
		<button *ngIf="!me" (click)="login()" class="btn btn-facebook">
			<i class="fa fa-facebook"></i>
			<span>Login with Facebook</span>
		</button>
	</section>
</div>`,
	host: {
		'[class.loading]': 'false',
		'(click)': `dropdown = ''`,
	},
	pipes: [
		FirebaseValuePipe,
		FirebaseLoadedPipe,
		SortPipe,
	],
	directives: [
		AvatarComponent,
		HuntComponent,
		EnterpressDirective,
	],
})
export class App {
	private me: Object;
	private huntId: string;
	private firebase: Firebase = new FirebaseHelper('https://treasure-league.firebaseio.com');

	constructor() {
		// authed
		this.firebase.ref().onAuth(authData => {
			if (authData) {
				this.me = {
					name: authData.facebook.displayName,
					facebookId: authData.facebook.id,
					uid: authData.uid,
				};

				// update user data
				let meRef = this.firebase.ref('users', this.me.uid);
				meRef.set(this.me);

				// online presence
				this.firebase.ref('.info/connected').on('value', snap => {
					if (snap.val()) {
						meRef.child('online').onDisconnect().set(new Date().toISOString());
						meRef.child('online').set(true);
					}
				});

				// auto-pick huntId
				this.firebase.ref('users:data', this.me.uid).once('value').then(snap => {
					let userData = snap.val();
					if (userData && userData.huntId) {
						// load the hunt the user was last looking at
						this.huntId = userData.huntId;
					} else {
						// auto-set huntId to user's latest hunt
						this.firebase.ref('users:data', this.me.uid, 'hunts').limitToLast(1).once('child_added').then(snap => this.huntId = snap.key());
					}
				});

				// accept invite
				var inviteId = new URLSearchParams(location.search.substr(1)).get('inviteId');
				if (inviteId) {
					this.firebase.ref('invites', inviteId).once('value').then(snap => {
						// snap.ref().child('accepted').push({
						// 	creator: this.me.uid,
						// 	created: new Date().toISOString(),
						// });
						let huntId = snap.child('huntId').val();
						Promise.all([
							this.firebase.ref('users:data', this.me.uid, 'hunts', huntId).set(true),
							this.firebase.ref('hunts:data', huntId, 'users', this.me.uid).set(true),
						]).then(() => {
							// load it
							this.huntId = huntId;

							// log that this invite was accepted
							this.firebase.ref('users:data', this.me.uid, 'invites:accepted', inviteId).set(new Date().toISOString());
						});
					});
				}
			} else {
				this.me = null;
				this.huntId = null;
			}
		});
	}

	login() {
		// fallback ofr browser which don't support popups
		this.firebase.ref().authWithOAuthPopup('facebook').catch(err => {
			if (err.code === 'TRANSPORT_UNAVAILABLE') {
				this.firebase.ref().authWithOAuthRedirect('facebook', err => {
					if (err) console.error(err);
				});
			} else {
				console.error(err);
			}
		});
	}

	// hunts
	createHunt() {
		if (!this.newHuntName) return;

		let huntId = this.firebase.ref('hunts').push().key(),
			hunt = {
				name: this.newHuntName,
				created: new Date().toISOString(),
				creator: this.me.uid,
			};

		return this.firebase.ref().update({
			[`hunts/${huntId}`]: hunt,
			[`users:data/${this.me.uid}/hunts/${huntId}`]: true,
			[`hunts:data/${huntId}/users/${this.me.uid}`]: true,
		}).then(() => {
			this.newHuntName = '';
			this.huntId = huntId;
		});
	}
	updateHunt(hunt) {
		if (!hunt.name) return;

		let updatedHunt = this.firebase.clean(hunt);
		updatedHunt.updated = new Date().toISOString();
		updatedHunt.updator = this.me.uid;

		return this.firebase.ref('hunts', hunt.$id).update(updatedHunt);
	}
	deleteHunt(hunt, skipConfirm) {
		let huntId = hunt.$id;
		return doConfirm(skipConfirm).then(() => {
			return this.firebase.ref().update({
				[`users:data/${this.me.uid}/hunts/${huntId}`]: null,
				[`hunts:data/${huntId}/users/${this.me.uid}`]: null,
				[`hunts/${huntId}`]: null,
			}).then(nil => {
				this.huntId = '';
			});
		});
	}
}