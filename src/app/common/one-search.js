/**
 * oneSearch Provider:
 *  This is the core of the oneSearch application.
 *  Search engines (i.e., resources) use the oneSearch Provider to register as searchable.
 *  This allows resources/engines to be easily plug-able and templated independent of each other.
 *
 *  The oneSearch Provider expects engines to register in the config phase.
 *  Engines are registered using the Provider's engine(engine_name, params) function:
 *      engine_name: String - defines the identifier for the engine
 *      params: Object - defines details for querying the engine (see example below)
 *
 *  Example:
 *
 *  // Define the engine as an Angular module
 *  angular.module('engines.MY_ENGINES_NAME')
 *
 *  //Register the engine's configuration with the oneSearch Provider
 *  .config(['oneSearchProvider', function(oneSearchProvider){
 *      oneSearchProvider.engine('MY_ENGINE_NAME', {
 *          id: String|Integer, //The id given to the backend JSON response handler that identifies the engine
 *          resultsPath: String, // A string representing the Object path to the search results (e.g., "engine.path.to.results")
            totalsPath: String, // Optional - A string representing the Object path to the total number of results found
            mediaTypes: { // Optional - Requires mediaTypesProvider module - An Object that specify media type qualifiers within the engines results
                path: String // The base path in the results object for the media type qualifier
                types: {    // Object that specifies what media types there are and how to identify them
                    TYPE_LABEL: String|Array // TYPE_LABEL will be the type id and the String or Array of Strings will represent the value given from the 'path' specified above.
                }
            },
            templateUrl: String //a string representing that url path to the engine's template
            controller: Function|String //an injectable controller for the engine - can be a Function or String referring to an existing Controller
        });
    });
 *
 */
angular.module('common.oneSearch', [])

    .factory('Search', ['$resource', function($resource){
        return $resource("//wwwdev2.lib.ua.edu/oneSearch/api/search/:s/engine/:engine/limit/:pp");
    }])

    .provider('oneSearch', ['mediaTypesProvider', function oneSearchProvider(mediaTypesProvider){
        //private object that holds registered engines
        var _engines = {};

        //function to allow engines to register as searchable
        this.engine = function(name, engine){
            if (angular.isString(name)){
                var defaults = {
                    id: null, resultsPath: null, totalsPath: null, mediaTypes: null, templateUrl: null, filterQuery: null, controller: null
                };

                var e = angular.extend(defaults, engine);
                if (e.id){
                    if (e.mediaTypes){
                        Object.keys(e.mediaTypes.types).map(function(type){
                            mediaTypesProvider.type(type, name);
                        })
                    }
                    else{ //if no mediaTypes are defined, the engine is considered it's own media type
                        mediaTypesProvider.type(name, name);
                        e.mediaTypes = name;
                    }
                    e.name = name;
                    _engines[name] = e;
                }
            }
            else{
                console.log({Error: "oneSearch engine must have STRING defined name", engineParams: engine});
            }
        };

        this.$get = ['$http', '$parse', 'enginesTemplateFactory', 'SearchParams', 'Search', function($http, $parse, enginesTemplateFactory, SearchParams, Search){

            return {
                engines: _engines, // Expose engines at Service level
                searchAll: function(params){
                    //extend give params with default SearchParams
                    angular.extend(params, SearchParams);

                    // Cycle through each registered engine, send the GET request, then return $http's promise by default.
                    // Returning the promise, instead of the JSON data, allows for async loading of results.
                    angular.forEach(_engines, function(engine, name){
                        //Create a local parameters variable 'p' and specify the engine id.
                        var p = {engine: engine.id};

                        //Extend local parameters by global params.
                        angular.extend(p, params);

                        //if filterQuery present, add it to query
                        // TODO: add proper REST support by accepting filter queries as objects and not just strings
                        if (engine.filterQuery !== null){
                            p.s += ' ' + engine.filterQuery;
                        }

                        /*console.log({
                            engine: engine,
                            params: p
                        });*/

                        // Store the $http response promise in the engine's object with key 'response
                        engine.response = Search.get(p); //$http({method: 'GET', url: url, params: p});

                        // Create results getter function from given results JSON path
                        if (angular.isDefined(engine.resultsPath)){
                            engine.getResults = $parse(engine.resultsPath);
                        }

                        // Create results getter function from given results JSON path
                        if (angular.isDefined(engine.totalsPath)){
                            engine.getTotal = $parse(engine.totalsPath);
                        }

                        // Put engine's object in private _engines object
                        _engines[name] = engine;
                    });

                    // Return all engines with response promises, and getter functions
                    return _engines;
                },
                search: function(engName, params, search_url){
                    if (!angular.isDefined(search_url))
                        console.log("Error: URL is not defined!");
                    var engine = _engines[engName];
                    var p = {engine: engine.id};

                    //Extend local parameters by global params.
                    angular.extend(p, params);

                    //if filterQuery present, add it to query
                    // TODO: add proper REST support by accepting filter queries as objects and not just strings
                    if (engine.filterQuery !== null){
                        p.s += ' ' + engine.filterQuery;
                    }

                    /*console.log({
                     engine: engine,
                     params: p
                     });*/

                    // Store the $http response promise in the engine's object with key 'response
                    engine.response = $http({method: 'GET', url: search_url, params: p});

                    // Create results getter function from given results JSON path
                    if (angular.isDefined(engine.resultsPath)){
                        engine.getResults = $parse(engine.resultsPath);
                    }

                    // Create results getter function from given results JSON path
                    if (angular.isDefined(engine.totalsPath)){
                        engine.getTotal = $parse(engine.totalsPath);
                    }

                    // Put engine's object in private _engines object
                    return engine;
                },
                getEngineTemplate: function(engine){
                    return enginesTemplateFactory.get(engine);
                },
                getEngineController: function(engine){
                    return angular.isDefined(engine.controller) ? engine.controller : null;
                }

            }
        }]
    }])

    .controller('OneSearchCtrl', ['$scope', '$location', '$rootScope', function($scope, $location, $rootScope){
        $scope.searchText;
        $scope.search = function(){
            if ($scope.searchText){
                // Compensate for when not on home page
                // Since WP pages aren't loaded as angular routes, we must detect if there is no '#/PATH' present
                // after the URI (or that it's not a 'bento' route), then send the browser to a pre-build URL.
                if (!$location.path() || $location.path().indexOf('/bento') < 0){
                    var url = '//' + $location.host() + '#/bento/'+$scope.searchText;
                    window.location = url; //Angular 1.2.8 $location is too limited...
                }
                else{
                    $location.path('/bento/'+$scope.searchText);
                }
            }
        }

        $rootScope.$on('$routeChangeSuccess', function(event,currentRoute){
            var s = currentRoute.params.s;
            if ($scope.searchText !== s){
                $scope.searchText = s;
            }
        });
    }])