//our root app component
import {Component, Directive, Input, Output, EventEmitter, ElementRef, Pipe, PipeTransform} from 'angular2/core';
import {FirebaseHelper, FirebaseValuePipe, FirebaseArrayPipe} from './firebase-helper';

function doConfirm(skip) {
	return new Promise((resolve, reject) => {
		if (skip || confirm('Are you sure?')) return resolve();
		return reject();
	});
}

@Component({
	selector: '[avatar]',
	template: `<img [src]="getPhotoUrl(user?.facebookId)" alt="" [width]="size" [height]="size" />`,
	host: {
		'[title]': 'user?.name',
		'[class.avatar]': 'true',
	},
})
class AvatarComponent {
	@Input('avatar') user: object = {};
	@Input() size: number = 24;

ngOnInit() {
	console.log(this.user);
}
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

@Directive({
	selector: '[scrollTo]',
})
class ScrollToDirective {
	@Input() scrollTo: any;

	constructor(private el: ElementRef) {}
	ngOnInit() {
		console.log(
			this.el.nativeElement.scrollTop = this.el.nativeElement.scrollHeight
		);
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
		<figure [avatar]="users[message.creator]"></figure>
		<div class="content">
			<header>
				<timestamp [innerHTML]="message?.created"></timestamp>
			</header>
			<div *ngIf="!message.$editing" (click)="message.$active = ! message.$active" [markdown]="message.content"></div>
			<div *ngIf="message.$editing" class="editing">
				<textarea [(ngModel)]="message.content"></textarea>
			</div>
			<footer *ngIf="message.$editing">
				<button (click)="update.next({message: message, event: $event})">Save</button>
				<button (click)="message.$editing = false; message.content = message.$content">Cancel</button>
			</footer>
			<footer *ngIf="message.creator === user.uid && !message.$editing">
				<button (click)="message.$editing = true; message.$content = message.content">Edit</button>
				<button (click)="delete.next({message: message, event: $event})">Delete</button>
			</footer>
		</div>
	</li>
	<li *ngIf="!messages.length" class="message empty">No comments yet.</li>
</ul>`,
	directives: [
		AvatarComponent,
		MarkdownDirective,
	],
})
class MessagesComponent {
	@Input() messages: array;
	@Input() users: object;
	@Input() user: object;

	@Output() update: EventEmitter = new EventEmitter();
	@Output() delete: EventEmitter = new EventEmitter();
}

@Component({
	selector '[messagesRef]',
	template: `
<div [messages]="messagesRef | value | array" [users]="users" [user]="user" (update)="update($event.message.$id, $event.message.content)" (delete)="delete($event.message.$id, $event.event.shiftKey)">
</div>
<footer>
	<textarea [(ngModel)]="typing" (keypress)="isEnter($event) ? send(typing) : null"></textarea>
	<a (click)="send(typing)"><i class="fa fa-send"></i></a>
</footer>`,
	pipes: [
		FirebaseValuePipe,
		FirebaseArrayPipe,
	],
	directives: [
		MessagesComponent,
	],
})
class MessagesRefComponent {
	@Input() messagesRef: Firebase;
	@Input() users: object;
	@Input() user: object;

	private typing: string = '';

	isEnter(e) {
		return (e.keyCode === 13 /* enter */ && !e.shiftKey);
	}
	send(content) {
		if (content !== undefined) {
			this.messagesRef.push({
				created: new Date().toISOString(),
				creator: this.user.uid,
				content: content,
			});

			this.typing = '';
		}
	}
	update(messageId, content) {
		if (content !== undefined) {
			this.messagesRef.child(messageId).update({
				updated: new Date().toISOString(),
				updator: this.user.uid,
				content: content,
			});
		}
	}
	delete(messageId, skipConfirm) {
		return doConfirm(skipConfirm).then(() => this.messagesRef.child(messageId).remove());
	}
}


@Component({
	selector: 'body',
	template: `
		<aside>
			<header>
				<h1><a href="http://treasureleague.com/" target="_blank">Treasure League</a> <span style="white-space: nowrap;">Clue Explorer</span></h1>
				<button (click)="me ? firebase.ref().unauth() : firebase.ref().authWithOAuthPopup('facebook')" [innerHTML]="me ? 'Logout' : 'Login with Facebook'"></button>
			</header>
			<section *ngIf="me">
				<header>
					<h2>My Hunts</h2>
					<ul>
						<li *ngFor="#hunt of usersHuntsIds | value:firebase.ref('hunts') | array">
							<header>
								<a (click)="huntId = hunt.$id" [innerHTML]="hunt.name"></a>
								<button (click)="deleteHunt(hunt.$id, $event.shiftKey)">&times;</button>
							</header>
							<ul [hidden]="hunt.$id !== huntId">
								<li *ngFor="#user of firebase.ref('hunts:users', hunt.$id) | value:firebase.ref('users') | array">
									<figure [avatar]="user" [size]="20"></figure>
									<span [innerHTML]="user.name"></span>
								</li>
							</ul>
						</li>
						<li>
							<input [(ngModel)]="newHuntName" placeholder="Hunt name" />
							<button (click)="createHunt()">Create</button>
						</li>
					</ul>
				</header>
			</section>
		</aside>
		<main>
			<div *ngIf="!huntId || !(firebase.ref('hunts:data', huntId, 'clues') | value)">Loading...</div>
			<section *ngIf="huntId">
				<article *ngFor="#clue of firebase.ref('hunts:data', huntId, 'clues') | value | array" (mouseenter)="play(clue)" (mouseleave)="stop(clue)" (touchstart)="play(clue)" (touchend)="stop(clue)" [id]="clue.$id" class="clue {{ active(clue) }}">
					<header>
						<a [href]="'#' + clue.$id" [innerHTML]="clue.num || '#'"></a>
						<a (click)="active(clue, 'editing')" [class.active]="active(clue) === 'editing'"><i class="fa fa-edit"></i></a>
					</header>
					<aside>
						<figure>
							<img [src]="clue.image" />
						</figure>
						<div class="information">
							<div class="fieldset">
								<input [(ngModel)]="clue.num" placeholder="Number" />
								<textarea [(ngModel)]="clue.notes" placeholder="Explanation"></textarea>
								<textarea [(ngModel)]="clue.solution" placeholder="Solution"></textarea>
							</div>
							<footer>
								<a (click)="deleteClue(firebase.ref('hunts:data', huntId, 'clues', clue.$id), $event.shiftKey)"><i class="fa fa-trash-o"></i></a>
								<a (click)="firebase.ref('hunts:data', huntId, 'clues', clue.$id).update(firebase.clean(clue))"><i class="fa fa-save"></i></a>
							</footer>
						</div>
						<div class="conversation" [messagesRef]="firebase.ref('hunts:data', huntId, 'messages', clue.$id)" [users]="firebase.ref('hunts:users', huntId) | value:firebase.ref('users')" [user]="me"></div>
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
						<a (click)="active(clue, 'conversing')" [class.active]="active(clue) === 'conversing'">
							<i class="fa fa-comments"></i>
							<small [innerHTML]="(firebase.ref('hunts:data', huntId, 'messages', clue.$id) | value | length) || ''"></small>
						</a>
						<a *ngIf="clue.notes || clue.solution" (click)="active(clue, 'resolving')"><i class="fa fa-question-circle" [class.active]="active(clue) === 'resolving'"></i></a>
					</footer>
				</article>
				<article *ngIf="firebase.ref('hunts:data', huntId, 'clues') | value" class="clue new">
					<div>
						Drop Image Here<br /><br />
						<small>or</small><br />
						Click to Upload
					</div>
					<input type="file" accept="image/*" (change)="upload(firebase.ref('hunts:data', huntId, 'clues').push().child('image'), $event.target.files)" />
				</article>
			</section>
		</main>
	`,
	pipes: [
		FirebaseValuePipe,
		FirebaseArrayPipe,
		LengthPipe,
	],
	directives: [
		AvatarComponent,
		MarkdownDirective,
		ScrollToDirective,
		MessagesRefComponent,
	],
})
export class App {
	public hunt: object = {};
	public clues: array = [];

	constructor() {
		// public
		this.firebase = new FirebaseHelper('https://treasure-league.firebaseio.com');

		// authed
		this.firebase.ref().onAuth(authData => {
			this.me = authData;

			if (authData) {
				// store up-to-date user data
				this.firebase.ref('users', this.me.uid).set({
					name: authData.facebook.displayName,
					facebookId: authData.facebook.id,
					uid: authData.uid,
				});

				this.usersHuntsIds = this.firebase.ref('users:hunts', this.me.uid);
				// auto-set huntId to user's latest hunt
				this.usersHuntsIds.limitToLast(1).once('child_added').then(snap => this.huntId = snap.key());
			} else {
				this.huntId = null;
			}
		});
	}
	play(clue) {
		if (clue.audio) {
			clue.$audio = clue.$audio || new Audio(clue.audio);
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

	active(clue, active) {
		if(active) clue.$active = clue.$active === active ? '' : active;
		return clue.$active || '';
	}

	// editing
	upload(ref, fileList) {
		new FirebaseFileUploader(ref).upload(fileList, true);
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
	deleteClue(clueRef, skipConfirm) {
		return doConfirm(skipConfirm).then(() => clueRef.remove());
	}
}

