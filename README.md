# Laravel Deploy Preview

prereq
- wildcard subdomain dns (document this)

todo
- support vapor?
    - make both api keys (forge/vapor) optional but always make sure _one_ of them is present, infer the platform from which one it is
- test lots of invalid input
- add support for multiple servers with different domains
- add support for multiple servers with _one_ domain (i think this is gonna be reeeeally hard)
- add support for as many Forge services/settings as possible, e.g.:
    - queues
    - other kinds of databases
    - custom deploy scripts
    - isolation
    - php versions?
    - https
- tear down sites when PR is closed
    - delete database
    - delete site
    - delete job
    - queues??

security
- HUGE warning about automatically running code from rando PRs
