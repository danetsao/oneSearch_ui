angular.module('oneSearch.common')
    .factory('dataFactory', function($http) {
        return {
            get: function(url) {
                return $http.get(url).then(function(resp) {
                    return resp.data; // success callback returns this
                });
            }
        };
    })
    .directive('suggestOneSearch', function($timeout) {
        return {
            restrict: 'AEC',
            scope: {
                prompt: '@',
                model: '=',
                search: '='
            },
            controller: function($scope, $window, $timeout, dataFactory){
                $scope.items = {};
                $scope.filteredItems = [];
                $scope.model = "";
                $scope.current = -1;
                $scope.originalValue = $scope.model;
                $scope.dataRequested = false;
                $scope.numShow = 5;

                // hides the list initially
                $scope.selected = true;

                $scope.onChange = function(){
                    var lastSpace = $scope.model.lastIndexOf(" ");
                    $scope.selected = false;

                    if ($scope.model.length - lastSpace <= 3 || $scope.model.indexOf($scope.originalValue) < 0){
                        $scope.items = {};
                        $scope.setCurrent(-1, false);
                        $scope.dataRequested = false;
                    }
                    if ($scope.model.length - lastSpace > 3 && !$scope.dataRequested){
                        dataFactory.get('//wwwdev2.lib.ua.edu/oneSearch/api/suggest/' + $scope.model)
                            .then(function(data) {
                                $scope.items.suggest = data;
                                $scope.setCurrent(-1, false);
                            });
                        $scope.dataRequested = true;
                    }
                    if ($scope.model.length > 2){
                        $timeout(function() {
                            dataFactory.get('//wwwdev2.lib.ua.edu/oneSearch/api/recommend/' + $scope.model)
                                .then(function(data) {
                                    $scope.items.recommend = data;
                                });
                            dataFactory.get('//wwwdev2.lib.ua.edu/staffDir/api/subject/' + $scope.model + '/match/startwith')
                                .then(function(data) {
                                    $scope.items.subjects = data;
                                });
                            dataFactory.get('//www.googleapis.com/customsearch/v1?key=AIzaSyCMGfdDaSfjqv5zYoS0mTJnOT3e9MURWkU&cx=003453353330912650815:lfyr_-azrxe&q=' +
                            $scope.model + '&siteSearch=ask.lib.ua.edu')
                                .then(function(data) {
                                    $scope.items.faq = data;
                                });
                        }, 200);
                    }
                    $scope.originalValue = $scope.model;
                };
                $scope.go = function ( path ) {
                    $scope.model = "";
                    $scope.originalValue = $scope.model;
                    $window.location.href = path;
                };
                $scope.setCurrent = function(index, forceModel) {
                    $scope.current = index;
                    if (typeof $scope.items.suggest != 'undefined')
                        for (var i = 0; i < $scope.items.suggest.length; i++)
                            $scope.items.suggest[i].class = '';
                    if (index >= 0)
                        if ($scope.filteredItems.length > 0){
                            if (index > $scope.filteredItems.length - 1)
                                index = $scope.filteredItems.length - 1;
                            if (forceModel)
                                $scope.model = $scope.filteredItems[index].search;
                            $scope.filteredItems[index].class = 'active';
                            $scope.current = index;
                        }
                };
                $scope.onFocus = function(){
                    if ($scope.model.length > 2){
                        $scope.selected = false;
                    }
                };
                $scope.onBlur = function($event){
                    $scope.selected = true;
                };
                $scope.compare = function(query){
                    return function(item){
                        if (item.search.indexOf(query) == 0 &&
                            !angular.equals(item.search.toLowerCase(), query.toLowerCase()))
                            return true;
                        return false;
                    };
                };
            },
            link: function(scope, elem, attrs) {
                elem.bind("keydown", function (event) {
                    switch(event.keyCode){
                        //ArrowUp
                        case 38:
                            if (scope.current > 0){
                                scope.setCurrent(scope.current - 1, true);
                                event.preventDefault();
                            } else {
                                scope.setCurrent(-1, false);
                                scope.model = scope.originalValue;
                                event.preventDefault();
                            }
                            break;

                        //ArrowDown
                        case 40:
                            if (scope.model.length > 2 && scope.current < scope.numShow - 1)
                                if (scope.current < scope.items.suggest.length - 1){
                                    scope.setCurrent(scope.current + 1, true);
                                    event.preventDefault();
                                }
                            break;

                        //Enter
                        case 13:
                            scope.selected = true;
                            break;

                        default:
                            break;
                    }
                    scope.$apply();
                });
                scope.handleSelection = function(selectedItem) {
                    $timeout(function() {
                        scope.model = selectedItem;
                        scope.selected = true;
                        scope.$apply();
                        scope.search();
                    }, 0);
                };
            },
            templateUrl: 'common/directives/suggest/suggest.tpl.html'
        };
    })