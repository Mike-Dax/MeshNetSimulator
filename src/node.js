/*
* Example Node implementation.
* Every node routes a packet to a random neighbor until it reaches the final destination.
*/

function Node(mac, meta = null) {
  /* Required fields */

  // Basic data
  this.mac = mac
  this.meta = meta
  this.incoming = []
  this.outgoing = []

  /* Additional fields */

  // Record next hop neighbours
  this.neighbours = {}

  // pick a highest person
  this.distributedClock = Math.floor(Math.random() * 1000)
  this.distanceFromLeader = 0

  this.needsToSendClock = true

  this.internalClock = 0

  // neighbour latencies
  this.neighbourLatencies = {}
  this.neighbourLatencyHeartbeats = {}

  this.randomUpdateRate = Math.floor(Math.random() * 100)

  this.blink = 0
}

var TYPE_NEIGHBOUR_CHECK = 0
var TYPE_HEARTBEAT = 1
var TYPE_HEARTBEAT_REPLY = 2
var TYPE_CLOCK_SYNC = 3
var TYPE_ASK_NEIGHBOURS_IF_CLOCK_CORRECT = 4

Node.prototype.broadcastNeighbourCheck = function() {
  var packet = new Packet(this.mac, BROADCAST_MAC, this.mac, BROADCAST_MAC)
  packet.type = TYPE_NEIGHBOUR_CHECK

  this.outgoing.push(packet)
}

Node.prototype.broadcastCurrentNum = function() {
  var packet = new Packet(this.mac, BROADCAST_MAC, this.mac, BROADCAST_MAC)
  packet.type = TYPE_CLOCK_SYNC
  packet.distributedClock = this.distributedClock
  packet.distanceFromLeader = this.distanceFromLeader

  this.outgoing.push(packet)
}

Node.prototype.step = function() {
  // Send a broadcast to direct neighbours
  if (Object.keys(this.neighbours).length === 0) {
    this.broadcastNeighbourCheck()
  }

  this.shouldBroadcastNum = false

  // if we have neighbours, check if we have their latency
  if (Object.keys(this.neighbours).length > 0) {
    var neighbourMacs = Object.keys(this.neighbours)
    for (var i = 0; i < neighbourMacs.length; i += 1) {
      var neighbourMac = neighbourMacs[i]

      if (
        !this.neighbourLatencyHeartbeats[neighbourMac] ||
        this.internalClock > this.neighbourLatencyHeartbeats[neighbourMac] + 20
      ) {
        this.neighbourLatencyHeartbeats[neighbourMac] = this.internalClock

        var packet = new Packet(this.mac, neighbourMac, this.mac, neighbourMac)
        packet.type = TYPE_HEARTBEAT

        this.outgoing.push(packet)
      }
    }
  }

  if (this.blink > 0) {
    this.blink = this.blink - 1
  }

  if (this.distributedClock % 10 === 0) {
    this.blink = 3
  }

  // TODO: replace this with 'when I know i've connected'
  if (this.distributedClock % this.randomUpdateRate === 0) {
    this.broadcastNeighbourCheck()
    this.shouldBroadcastNum = true
  }

  // loop through all the incoming packets
  for (var i = 0; i < this.incoming.length; i += 1) {
    var packet = this.incoming[i]

    // Catch broadcast packets and record neighbor
    if (packet.type === TYPE_NEIGHBOUR_CHECK) {
      this.neighbours[packet.transmitterAddress] = true
      continue
    }

    // Catch broadcast packets and record neighbor
    if (packet.type === TYPE_CLOCK_SYNC) {
      if (this.neighbourLatencies[packet.transmitterAddress]) {
        var whatTheClockMightBe = packet.distributedClock + this.neighbourLatencies[packet.transmitterAddress] / 2 // prettier-ignore

        if (whatTheClockMightBe > this.distributedClock) {
          // add to our latency from the leader

          this.distributedClock = whatTheClockMightBe

          this.distanceFromLeader = packet.distanceFromLeader + this.neighbourLatencies[packet.transmitterAddress] / 2 // prettier-ignore

          // broadcast again
          this.shouldBroadcastNum = true
        }
      }

      continue
    }

    // reply to heartbeats
    if (packet.type === TYPE_HEARTBEAT) {
      var packet = new Packet(
        this.mac,
        packet.transmitterAddress,
        this.mac,
        packet.transmitterAddress
      )
      packet.type = TYPE_HEARTBEAT_REPLY

      this.outgoing.push(packet)
      continue
    }

    // consume heartbeats
    if (packet.type === TYPE_HEARTBEAT_REPLY) {
      var latency =
        this.internalClock -
        this.neighbourLatencyHeartbeats[packet.transmitterAddress]

      this.neighbourLatencies[packet.transmitterAddress] = latency

      // if we have as many heartbeats as neighbours, send out a clock sync

      if (
        Object.keys(this.neighbours).length ===
          Object.keys(this.neighbourLatencies).length &&
        this.needsToSendClock
      ) {
        this.shouldBroadcastNum = true
        this.needsToSendClock = false
      }
      continue
    }

    // Packet arrived at the destination
    if (packet.destinationAddress === this.mac) {
      console.log('un dealt with packet somehow arrived at destination')
      continue
    }

    // if we're actually routing a packet
    var others = Object.keys(this.neighbours)
    if (others.length) {
      // if the destination is one of our neighbours, route direct to it
      if (this.neighbours[packet.destinationAddress]) {
        packet.transmitterAddress = this.mac
        packet.receiverAddress = packet.destinationAddress

        this.outgoing.push(packet)
        continue
      }

      // otherwise randomly route it
      var nextHop = others[Math.floor(Math.random() * others.length)]

      packet.transmitterAddress = this.mac
      packet.receiverAddress = nextHop

      this.outgoing.push(packet)
    }
  }

  if (this.shouldBroadcastNum) {
    this.broadcastCurrentNum()
  }

  this.distributedClock = this.distributedClock + 1
  this.internalClock = this.internalClock + 1
}

// Name displayed under the node
Node.prototype.getNodeName = function() {
  // Find hostname in meta data, display MAC address as fallback
  return this.distanceFromLeader ? this.distanceFromLeader.toString() : '' //findValue(this.meta, 'hostname', this.mac)
}

// Label on top of the node body
Node.prototype.getNodeLabel = function() {
  return ''
}

// Color of the ring around the node body
Node.prototype.getRingColor = function() {
  return ''
}

// Color of the round node body
Node.prototype.getBodyColor = function() {
  if (Object.keys(this.neighbours).length === 0) {
    return '#000'
  }

  if (
    Object.keys(this.neighbourLatencies).length <
    Object.keys(this.neighbours).length
  ) {
    return '#555'
  }

  if (this.distanceFromLeader === 0) {
    return this.blink > 0 ? '#FF00FF' : '#8F00FF'
  }

  return this.blink > 0 ? '#f00' : '#fff'
}

// Number of small red circles around the node
Node.prototype.getClientCount = function() {
  // Count unicast packets
  var count = 0
  for (var i in this.outgoing) {
    count += 1
  }
  for (var i in this.incoming) {
    count += 1
  }

  return count ? count : 0 // Object.keys(this.neighbours).length
}

Node.prototype.reset = function() {
  this.incoming = []
  this.outgoing = []
  this.neighbours = {}

  this.distributedClock = Math.floor(Math.random() * 1000)
  this.distanceFromLeader = 0
  this.internalClock = 0

  this.needsToSendClock = true

  this.neighbourLatencies = {}
  this.neighbourLatencyHeartbeats = {}
}

// For the transition to new implementations
Node.prototype.copyFromOldImplementation = function(oldNode) {
  copyExistingFields(oldNode, this)
}
