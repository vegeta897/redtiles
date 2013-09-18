angular.module('Redtiles', ['Redtiles.controllers', 'Redtiles.services', 'Redtiles.directives', 'LocalStorageModule'])
	.config(['$routeProvider', function($routeProvider) { // Set up URL page routing
		$routeProvider.
			when('/', {templateUrl: 'partials/main.html', controller: 'Default'}). // Main page
		    otherwise({redirectTo: ''}); // Redirect to main page if none of the above match
	}])
    .run(function($rootScope) {
        $rootScope.$on('$viewContentLoaded', function() {
            $(document).foundation(); // Init Foundation JS
        });
    });