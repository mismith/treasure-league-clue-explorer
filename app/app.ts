//our root app component
import {Component} from 'angular2/core';

@Component({
	selector: '[app]',
	template: `
		<main (click)="active = null">
			<header>
				<h1><a href="http://treasureleague.com/" target="_blank">Treasure League</a> <span style="white-space: nowrap;">Clue Explorer</span></h1>
				<h1 style="text-align: right;">Fire &amp; Ice</h1>
			</header>
			<section>
				<article *ngFor="#clue of clues; #num = index;" (mouseenter)="play(clue); clue.$hover = true;" (mouseleave)="stop(clue); clue.$hover = false;" (touchstart)="play(clue)" (touchend)="stop(clue)" [id]="num + 1" class="clue" [ngClass]="{active: active == num + 1, hover: clue.$hover}">
					<figure (click)="active = active === num + 1 ? null : num + 1; $event.stopPropagation();">
						<img [src]="'clues/Clue%20%23' + (num + 1) + '.png'" />
						<figcaption [innerHTML]="num + 1"></figcaption>
					</figure>
					<aside>
						<div>
							<h3 *ngIf="clue.notes">Explanation</h3>
							<div [innerHTML]="clue.notes"></div>
						</div>
						<footer *ngIf="clue.solution" (mouseenter)="clue.$solution = true" (touchstart)="clue.$solution = true" (mouseleave)="clue.$solution = false" (touchend)="clue.$solution = false" [class.hover]="clue.$solution">
							<h3>Solution</h3>
							<div [innerHTML]="clue.solution"></div>
						</footer>
					</aside>
				</article>
			</section>
		</main>
	`,
})
export class App {
	constructor() {
		this.active = location.hash.substr(1);

		var cluesRef = new Firebase('https://treasure-league.firebaseio.com');
		cluesRef.once('value').then(snap => this.clues = snap.val());
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
}
