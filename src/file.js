
function createFile(graph) {
  var self = {};

  function offerDownload(filename, text) {
    var a = document.createElement('a');
    a.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    a.setAttribute('download', filename);

    a.style.display = 'none';
    document.body.appendChild(a);

    a.click();
    document.body.removeChild(a);
  }

  function readFileContent(file, callback) {
    if (file) {
      var r = new FileReader();
      r.onload = function(e) {
        callback(e.target.result);
      };
      r.onerror = function(e) {
        alert('Failed to load file: ' + file.name + ' (' + e.target.error.name + ')');
      };
      r.readAsText(file);
    } else {
      alert('No file selected.');
    }
  }

  function readUrlContent(url, callback) {
    if (url.length) {
      var request = new XMLHttpRequest();
      request.onreadystatechange = function() {
        if (request.readyState == 4) {
          if (request.status == 200) {
            callback(request.responseText, url);
          } else {
            var msg = request.statusText;
            alert('Failed to load URL: ' + url + ' (' + (msg.length ? msg : "unknown") + ')');
          }
        }
      };
      request.open('GET', url, true);
      request.send();
    } else {
      alert('No URL selected.');
    }
  }

  function reloadJavaScriptFile(id, src) {
    // Remove script element
    var e = document.getElementById(id);
    e.parentNode.removeChild(e);

    // Create new script element
    var e = document.createElement('script');
    e.type = 'text/javascript';
    e.id = id;
    if (src.indexOf('\n') === -1) {
      e.src = src;
    } else {
      e.text = src;
    }
    document.head.appendChild(e);
  }

  self.reloadNodeImplementation = function reloadNodeImplementation (files, url) {
    function load(content) {
      function changeNodeImplementation() {
        var nodeMap = {};

        // Recreate all Node objects
        var intNodes = graph.getIntNodes();
        for (var i = 0; i < intNodes.length; i += 1) {
          var intNode = intNodes[i];
          var oldNode = intNode.o;
          var newNode = new Node(oldNode.mac, oldNode.meta);

          // Copy over fields
          if (typeof Node.prototype.copyFromOldImplementation !== "function") {
            copyExistingFields(oldNode, newNode);
          } else {
            newNode.copyFromOldImplementation(oldNode);
          }

          // Replace old node instance
          intNode.o = newNode;

          nodeMap[newNode.mac] = newNode;
        }

        graph.redraw();
      }
      reloadJavaScriptFile('node_js', content);
      setTimeout(changeNodeImplementation, 10);
    }

    if (files.length && files[0].name === url) {
      readFileContent(files[0], load);
    } else {
      readUrlContent(url, load);
    }
  }

  self.reloadPacketImplementation = function reloadPacketImplementation (files, url) {
    function load(content) {
      function changePacketImplementation() {
        function renewPackets(packets) {
          for (var i = 0; i < packets.length; i += 1) {
            var oldPacket = packets[i];
            var newPacket = new Packet(
              oldPacket.transmitterAddress,
              oldPacket.receiverAddress,
              oldPacket.sourceAddress,
              oldPacket.destinationAddress
            );

            // Copy over fields
            if (typeof Packet.prototype.copyFromOldImplementation !== "function") {
              copyExistingFields(oldPacket, newPacket);
            } else {
              newPacket.copyFromOldImplementation(oldPacket);
            }

            // Replace old packet instance
            packets[i] = newPacket;
          }
        }

        var intNodes = graph.getIntNodes();
        for (var i = 0; i < intNodes.length; i += 1) {
          var intNode = intNodes[i];
          renewPackets(intNode.o.incoming);
          renewPackets(intNode.o.outgoing);
        }

        graph.redraw();
      }
      reloadJavaScriptFile('packet_js', content);
      setTimeout(changePacketImplementation, 10);
    }

    if (files.length && files[0].name === url) {
      readFileContent(files[0], load);
    } else {
      readUrlContent(url, load);
    }
  }

  self.reloadLinkImplementation = function reloadLinkImplementation (files, url) {
    function load(content) {
      function changeLinkImplementation() {
        // Recreate all link objects
        var intLinks = graph.getIntLinks();
        for (var i = 0; i < intLinks.length; i += 1) {
          var intLink = intLinks[i];
          var oldLink = intLink.o;
          var newLink = new Link(oldLink.quality, oldLink.bandwidth, oldLink.channel);

          // Copy over fields
          if (typeof Link.prototype.copyFromOldImplementation !== "function") {
            copyExistingFields(oldLink, newLink);
          } else {
            newLink.copyFromOldImplementation(oldLink);
          }

          // Replace old link instance
          intLink.o = newLink;
        }

        graph.redraw();
      }

      reloadJavaScriptFile('link_js', content);
      setTimeout(changeLinkImplementation, 10);
    }

    if (files.length && files[0].name === url) {
      readFileContent(files[0], load);
    } else {
      readUrlContent(url, load);
    }
  }

  function toJSON(obj, indent = -1) {
    if (indent === -1) {
      return JSON.stringify(obj);
    } else if (indent === -2) {
      return JSON.stringify(obj, undefined, '\t');
    } else {
      return JSON.stringify(obj, undefined, indent);
    }
  }

  function saveNetJsonNetworkGraph(indent) {
    var intNodes = graph.getIntNodes();
    var intLinks = graph.getIntLinks();
    var nodes = [];
    var links = [];

    intNodes.forEach(function(e) {
      var node = {
        id: e.o.mac
      };
      if (e.o.meta) {
        node.properties = e.o.meta;
      }
      nodes.push(node);
    });

    intLinks.forEach(function(e) {
      var link = {
        source: e.source.o.mac,
        target: e.target.o.mac,
        cost: (100 / e.o.quality)
      };

      if (e.o.meta) {
        link.properties = e.o.meta;
      }
      links.push(link);
    });

    var json = {
      type: "NetworkGraph",
      protocol: "",
      version: "",
      metric: "tq",
      timestamp: (new Date).toISOString().slice(0, 19),
      directed: false,
      multigraph: false,
      links: links,
      nodes: nodes
    };

    offerDownload('netjson.json', toJSON(json, indent));
  }

  function saveNetMeshViewerGraph(indent) {
    var intLinks = graph.getIntLinks();
    var intNodes = graph.getIntNodes();
    var graphDataNodes = [];
    var graphDataLinks = [];

    intNodes.forEach(function(e) {
      graphDataNodes.push({
        id: e.o.mac,
        node_id: e.o.mac.replace(/:/g, '')
      });
    });

    intLinks.forEach(function(e) {
      graphDataLinks.push({
        bidirect: true,
        source: e.source.index,
        target: e.target.index,
        tq: (100 / e.o.quality),
        vpn: finValue(e.o.meta, 'vpn', (e.o.bandwidth > 50))
      });
    });

    var json = {
      batadv: {
        directed: false,
        graph: [],
        multigraph: false,
        nodes: graphDataNodes,
        links: graphDataLinks
      },
      version: 1
    };

    offerDownload('graph.json', toJSON(json, indent));
  }

  function saveNetMeshViewerNodes(indent) {
    var intNodes = graph.getIntNodes();
    var nodes = [];
    var paths = [
      ['firstseen'],
      ['flags', 'gateway'],
      ['flags', 'online'],
      ['lastseen'],
      ['nodeinfo', 'hardware', 'model'],
      ['nodeinfo', 'hostname'],
      ['nodeinfo', 'location', 'latitude'],
      ['nodeinfo', 'location', 'longitude'],
      ['nodeinfo', 'network', 'mac'],
      ['nodeinfo', 'node_id'],
      ['nodeinfo', 'owner', 'contact'],
      ['nodeinfo', 'software', 'firmware', 'release'],
      ['nodeinfo', 'system', 'role', 'site_code'],
      ['statistics', 'clients'],
      ['statistics', 'memory_usage'],
      ['statistics', 'rootfs_usage'],
      ['statistics', 'uptime']
    ];

    intNodes.forEach(function(e) {
      var meta = e.o.meta;
      var node = {};

      if (meta) {
        paths.forEach(function(path) {
          console.log('path: ' + path);
          var value = findValue(meta, path[path.length - 1], null);
          if (value !== null) {
            setValue(node, path, value);
          }
        });
      }

      nodes.push(node);
    });

    var json = {
      meta: {
        timestamp: (new Date).toISOString().slice(0, 19)
      },
      nodes: nodes,
      version: 2
    };

    offerDownload('nodes.json', toJSON(json, indent));
  }

  // Save graph data as meshviewer data
  self.saveFile = function saveFile(type, indent) {
    if (type === 'netjson_netgraph') {
      saveNetJsonNetworkGraph(indent);
    } else if (type === 'meshviewer_nodes') {
      saveNetMeshViewerNodes(indent);
    } else if (type === 'meshviewer_graph') {
      saveNetJsonNetworkGraph(indent);
    } else {
      alert('Unknown export type: ' + type);
    }
  }

  function loadNetJsonNetworkGraph(ret, nodes, links) {
    var nodeDict = {};
    for (var i in nodes) {
      var e = nodes[i];
      var mac = findValue(e, 'mac', e.id);
      var meta = e.properties;
      var node = {o: new Node(mac, meta)};
      ret.nodesArray.push(node);
      // Remember id => node mapping
      nodeDict[e.id] = node;
    }

    for (var i in links) {
      var e = links[i];
      // Source and target are strings
      var quality = limitFloat(('cost' in e) ? (100 / e.cost) : 100, 0, 100);
      var bandwidth = findValue(e, 'vpn', false) ? 80 : 20;
      ret.linksArray.push({
        source: nodeDict[e.source],
        target: nodeDict[e.target],
        o: new Link(quality, bandwidth)
      });
    }
  }

  function loadMeshviewerNodes(ret, nodes) {
    for (var i in nodes) {
      var e = nodes[i];
      var mac = findValue(e, 'mac', null);
      if (mac) {
        ret.nodesArray.push({
          o: new Node(mac, e)
        });
      }
    }
  }

  function loadMeshviewerLinks(ret, nodes, links) {
    for (var i in links) {
      var e = links[i];
      // source and target are indices into nodes
      var sourceMAC = nodes[e.source].id;
      var targetMAC = nodes[e.target].id;
      var quality = e.tq ? (100 / e.tq) : 100;
      var bandwidth = e.vpn ? 80 : 20;

      ret.linksArray.push({
        source: {o: new Node(sourceMAC)},
        target: {o: new Node(targetMAC)},
        o: new Link(quality, bandwidth)
      });
    }
  }

  self.loadFile = function loadFile(files, url) {
    function load(text) {
      var obj = JSON.parse(text);

      if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        return;
      }

      var ret = {
        nodesArray: [],
        linksArray: []
      };

      if (obj.type === "NetworkGraph") {
        // NetJSON NetworkGraph data
        loadNetJsonNetworkGraph(ret, obj.nodes, obj.links);
      } else if ('batadv' in obj) {
        // Meshviewer graph.json version 1
        loadMeshviewerLinks(ret, obj.batadv.nodes, obj.batadv.links);
      } else if ('nodes' in obj) {
        // Meshviewer nodes.json version 2
        loadMeshviewerNodes(ret, obj.nodes);
      } else {
        alert('Unrecognized input format.');
        return;
      }

      graph.addElements(ret.nodesArray, ret.linksArray);
    }

    if (files.length && files[0].name === url) {
      readFileContent(files[0], load);
    } else {
      readUrlContent(url, load);
    }
  }

  return self;
}
