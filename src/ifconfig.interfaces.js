'use strict';
var _ = require('lodash');

var MAC = 'HWaddr';
var INET = 'inet';
var BCAST = 'Bcast';
var DESTINATIONS = ['default', 'link-local'];

module.exports = function (cp) {
  return function (f) {
    // @todo add command timeout
    cp.exec('ifconfig', function (err, ifConfigOut, stderr) {
      if (err) {
        return f(err);
      }

      if (stderr) {
        return f(stderr);
      }

      cp.exec('route', function (err, routeOut, stderr) {
        if (err) {
          return f(err);
        }

        if (stderr) {
          return f(stderr);
        }

        f(null, parse(ifConfigOut, routeOut));
      });
    });
  };
};

function parse(ifConfigOut, routeOut) {
  return ifConfigOut.split('\n\n').map(function (inface) {
    var lines = inface.split('\n');

    /**
     * Format 1
     * link xx:xx HWaddr xx-xx-xx
     * link xx:xx HWaddr xx:xx:xx
     *
     * Format 1
     * inet xx:xxx.xxx.xxx.xxx mask|masque|...:xxx.xxx.xxx.xxx
     */

    return {
      name: getInterfaceName(_.first(lines)),
      ip: getInterfaceIpAddr(lines[1]),
      netmask: getInterfaceNetmaskAddr(lines[1]),
      broadcast: getBroadcastAddr(lines[1]),
      mac: getInterfaceMacAddr(lines[3]),
      gateway: getGateway(routeOut)
    };
  });
}

function getInterfaceName(firstLine) {
  return firstLine.split(' ')[0].replace(":","");
}

/**
 * extract mac adress
 *
 * ifconfig output:
 *   - link xx:xx HWaddr xx-xx-xx
 *   - link xx:xx HWaddr xx:xx:xx
 *
 * @param  {string} firstLine
 * @return {string}           Mac address, format: "xx:xx:xx:xx:xx:xx"
 */
function getInterfaceMacAddr(line) {
  if (!_.includes(line, "ether")) {
    return null;
  }
  return line.match(/([0-9a-zA-Z]{2}\:){5}[0-9a-zA-Z]{2}/)[0];
}

/**
 * extract ip addr
 *
 * ifconfig output:
 *   - inet xx:xxx.xxx.xxx.xxx mask|masque|...:xxx.xxx.xxx.xxx
 *
 * @param  {string} line
 * @return {string,null} xxx.xxx.xxx.xxx
 */
function getInterfaceIpAddr(line) {
  if (!_.includes(line, INET)) {
    return null;
  }
  return line.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/g)[0];
}

/**
 * extract netmask addr
 *
 * ifconfig output:
 *   - inet xx:xxx.xxx.xxx.xxx mask|masque|...:xxx.xxx.xxx.xxx
 *
 * @param  {string} line
 * @return {string,null} xxx.xxx.xxx.xxx
 */
function getInterfaceNetmaskAddr(line) {
  if (!_.includes(line, INET)) {
    return null;
  }
  return line.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/g)[1];
}

/**
 * extract broadcast addr
 * @param  {string} line
 * @return {string,null}      xxx.xxx.xxx.xxx
 */
function getBroadcastAddr(line) {
  if (!_.includes(line, BCAST)) {
    return null;
  }

  // inet adr:1.1.1.77  Bcast:1.1.1.255  Masque:1.1.1.0
  // @todo oh boy. this is ugly.
  return line.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/g)[2] || null;
}


/**
 * extract gateway ip
 * @param  {string} stdout
 * @return {string,null} default gateway ip or null
 */
function getGateway(stdout) {
  // @todo yep. this is ugly.
  return stdout
    .split('\n')
    .filter(function (line) {
      return _.some(DESTINATIONS, function (destination)  {
        return _.includes(line, destination);
      });
    })[0]
    .split(/\s+/)[1]
    .split('.')[0]
    .replace(/-/g, '.');
}
