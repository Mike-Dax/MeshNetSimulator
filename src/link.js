function Link(quality = 100, bandwidth = 50, channel = 0) {
  /* Required fields */

  /*
  [0..100] Link quality in percent
  The quality is 100% minus expected packet loss.
  A wireless link usually has a medium packet loss of 25%. A wired link maybe 2%.
  */
  this.quality = Math.floor(Math.random() * 25) + 75
  /*
  [0..] Number of packets
  The bandwidth is the number of packets that can be transmitted in one simulation step
  How this value is applied is decided in the transmit() method.
  */
  this.bandwidth = bandwidth
  /*
  [0..] Transmission medium
  Channel 0 represents a link over its own medium. The link does not influence any other links.
  Influence means that the packetCount for the transmit() method is not cumulated over multiple links.
  With channels >0 link can be grouped together, e.g. as to simulate multiple (e.g. wireless) interfaces.
  */
  this.channel = channel
  /*
  [1..] Latency
  How many steps it takes for a message to transfer across this link
  */
  this.latency = Math.floor(Math.random() * 5) + 1

  /*
  Packets currently transmitting through this link
  */
  this.inTransit = {}
}

Link.prototype.reset = function() {}

Link.prototype.getLinkLabel = function() {
  return ''
}

// Will a packet successfully traverse the link?
Link.prototype.transmit = function(packet, packetCount) {
  // Calculate packet transmission probability
  // The formula needs improvments!
  var n = 100 * (Math.min(packetCount, this.bandwidth) / this.bandwidth)
  var probability = this.quality / 100 * Math.pow(0.999, n)
  return probability > Math.random()

  // return true
}

// How long will the packet take to traverse the link?
Link.prototype.getLatency = function(packet, packetCount) {
  return this.latency
}

// For changing the implementation during simulation
Link.prototype.copyFromOldImplementation = function(oldLink) {
  copyExistingFields(oldLink, this)
}
