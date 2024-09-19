module.exports = {
    apps : [{
      name: "tools-page-analytics-server",
      script: "index.js",
      node_args: "--max_old_space_size=2048",
      args: "",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2000M',
      env: {
          PORT: 5555,
          VERBOSITY: 2
      },
      error_file: "/home/gapminder/logs/analytics-error.log",
      out_file: "/home/gapminder/logs/analytics-output.log",
      time: true
    }]
  };