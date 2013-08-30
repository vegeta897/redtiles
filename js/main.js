angular.module('Redtiles', ['Redtiles.controllers', 'Redtiles.services', 'Redtiles.directives'])
	.config(['$routeProvider', function($routeProvider) { // Set up URL page routing
		$routeProvider.
			when('/', {templateUrl: 'partials/main.html', controller: 'Default'}). // Main page
		    otherwise({redirectTo: ''}); // Redirect to main page if none of the above match
	}])
    .run(function($rootScope) {
        $rootScope.$on('$viewContentLoaded', function() {
            $(document).foundation();
            
            // Gallery controls show/hide logic
            $('#gallery').children('.controls').children('div').on('click', 'a', function(e) {
                var target = $(e.target.hash);
                if(!target.hasClass('hidden')) {
                    target.addClass('hidden');
                } else {
                    target.siblings('div').addClass('hidden');
                    target.removeClass('hidden');
                }
                return false;
            });
            
            // Initialize Masonry for image tiles
            var tileArea = document.querySelector('.tile-area');
            var tileMasonry = new Masonry( tileArea, {
                itemSelector: '.tile',
                columnWidth: 101,
                gutter: 4
            });
        });
    });