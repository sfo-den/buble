module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		pkg: '<json:package.json>',
		meta: {
		banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
			'<%= grunt.template.today("yyyy-mm-dd") %> */'
		},
		concat : {
		'build/epub_no_underscore.js': ['<banner>', 'libs/rsvp/rsvp.js', 'src/*.js'],
		'build/epub.js': ['<banner>', 'libs/underscore/underscore-min.js', 'libs/rsvp/rsvp.js', 'src/*.js'],
		'build/reader.js': ['<banner>', 'reader/reader.js', 'reader/controllers/*.js'],
		'build/hooks.js': ['<banner>', 'hooks/default/*.js'],
		'demo/js/libs/fileStorage.min.js': 'libs/fileStorage/fileStorage.min.js',
		'demo/js/libs/loader_filesystem.min.js': 'libs/fileStorage/workers/loader_filesystem.min.js',
		'demo/js/libs/jquery-2.0.3.min.js': 'libs/jquery/jquery-2.0.3.min.js',
		'demo/js/libs/inflate.js': 'libs/zip/inflate.js',
		'demo/js/libs/screenfull.min.js': 'libs/screenfull.min.js'
		},
		uglify: {
			options: {
					preserveComments: 'some'
			},
			my_target: {
				files: {
					'demo/js/epub.min.js': ['build/epub.js'],
					'build/epub.min.js': ['build/epub.js'],
					'demo/js/reader.min.js': ['build/reader.js'],
					'demo/js/hooks.min.js': ['build/hooks.js'],
					'build/hooks.min.js': ['build/hooks.js'],
					'demo/js/libs/zip.min.js': ['libs/zip/zip.js', 'libs/zip/zip-fs.js', 'libs/zip/zip-ext.js', 'libs/zip/mime-types.js'],
					'demo/js/libs/inflate.min.js': ['libs/zip/inflate.js'],
					'build/libs/zip.min.js': ['libs/zip/zip.js', 'libs/zip/zip-fs.js', 'libs/zip/zip-ext.js', 'libs/zip/mime-types.js'],
					'build/libs/inflate.js': ['libs/zip/inflate.js'],
					'build/libs/screenfull.min.js': ['libs/screenfull.min.js']
				}
			}
		},
		jshint: {
			all: ['src/**/*.js'],//, 'reader/**/*.js']
			options : {
				// Environments
				"browser": true,
				"devel": true,
				"worker": true,
				
				// Enforcing
				//"maxlen": 80,
				//"quotmark": "single",
				"trailing": true,
				"strict": false,
				
				// Relaxing
				"boss": true,
				"funcscope": true,
				"globalstrict": true,
				"loopfunc": true,
				"maxerr": 1000,
				"nonstandard": true,
				"sub": true,
				"validthis": true,
				
				"globals": { 
					"_": false,
					"define" : false,
					"module" : false
				}
			}
		}
	});
	
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	// Default task(s).
	grunt.registerTask('default', ['jshint', 'concat', 'uglify']);
};

