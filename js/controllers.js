/* Controllers */

angular.module('Redtiles.controllers', [])
	.controller('Default', ['$scope', 'reddit', function($scope, reddit) {
        
        reddit.getPosts(['pics','funny','1000words','wallpapers'],1).then(function (response) {
            console.log(response);
            $scope.results = response;
            
        });
    }]);