var UmxGruntConfig = require('umx-grunt-config');
module.exports = function(grunt) {
    var configurator = new UmxGruntConfig(require, grunt);
    configurator.initBump();
    configurator.initJshint();
    configurator.initMochaTest();
    configurator.initUglify();
    configurator.registerBumpTasks();
    grunt.initConfig(configurator.config);
    grunt.registerTask('test', [ 'jshint', 'mochaTest' ]);
    grunt.registerTask('build', [ 'test' ]);
    grunt.registerTask('commit', [ 'build', 'bump-commit' ]);
    grunt.registerTask('default', [ 'build' ]);
}
