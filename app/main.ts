//main entry point
import {bootstrap} from 'angular2/platform/browser';
//import {ROUTER_PROVIDERS, LocationStrategy, HashLocationStrategy} from 'angular2/router';
import {enableProdMode, provide} from 'angular2/core';
import {App} from './app';

//enableProdMode();
bootstrap(App, [
	//ROUTER_PROVIDERS,
	//provide(LocationStrategy, { useClass: HashLocationStrategy })
]);
