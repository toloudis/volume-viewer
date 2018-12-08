import AICSchannelData from './AICSchannelData.js';
import { getColorByChannelIndex } from './constants/colors.js';

/**
 * Provide dimensions of the volume data, including dimensions for texture atlas data in which the volume z slices
 * are tiled across a single large 2d image plane.
 * @typedef {Object} imageInfo
 * @property {string} name Base name of image
 * @property {string} version schema version preferably in semver format.
 * @property {number} width Width of original volumetric data prior to downsampling
 * @property {number} height Height of original volumetric data prior to downsampling
 * @property {number} channels Number of channels
 * @property {number} tiles Number of tiles, which must be equal to the number of z-slices in original volumetric data
 * @property {number} pixel_size_x Size of pixel in volumetric data to be rendered, in x-dimension, unitless
 * @property {number} pixel_size_y Size of pixel in volumetric data to be rendered, in y-dimension, unitless
 * @property {number} pixel_size_z Size of pixel in volumetric data to be rendered, in z-dimension, unitless
 * @property {Array.<string>} channel_names Names of each of the channels to be rendered, in order. Unique identifier expected
 * @property {number} rows Number of rows in tile array in each image.  Note tiles <= rows*cols
 * @property {number} cols Number of columns in tile array in each image.  Note tiles <= rows*cols
 * @property {number} tile_width Width of each tile in volumetric dataset to be rendered, in pixels
 * @property {number} tile_height Height of each tile in volumetric dataset to be rendered, in pixels
 * @property {number} atlas_width Total width of image containing all the tiles, in pixels.  Note atlas_width === cols*tile_width
 * @property {number} atlas_height Total height of image containing all the tiles, in pixels. Note atlas_height === rows*tile_height
 * @example let imgdata = {
  "width": 306,
  "height": 494,
  "channels": 9,
  "channel_names": ["DRAQ5", "EGFP", "Hoechst 33258", "TL Brightfield", "SEG_STRUCT", "SEG_Memb", "SEG_DNA", "CON_Memb", "CON_DNA"],
  "rows": 7,
  "cols": 10,
  "tiles": 65,
  "tile_width": 204,
  "tile_height": 292,
  // for webgl reasons, it is best for atlas_width and atlas_height to be <= 2048 
  // and ideally a power of 2.  This generally implies downsampling the original volume data for display in this viewer.
  "atlas_width": 2040,
  "atlas_height": 2044,
  "pixel_size_x": 0.065,
  "pixel_size_y": 0.065,
  "pixel_size_z": 0.29,
  "name": "AICS-10_5_5",
  "status": "OK",
  "version": "0.0.0",
  "aicsImageVersion": "0.3.0"
  };
 */

/**
 * A renderable multichannel volume image with 8-bits per channel intensity values.
 * @class
 * @param {imageInfo} imageInfo 
 */
function AICSvolume(imageInfo) {
  this.imageInfo = imageInfo;
  this.name = imageInfo.name;

  // clean up some possibly bad data.
  this.imageInfo.pixel_size_x = imageInfo.pixel_size_x || 1.0;
  this.imageInfo.pixel_size_y = imageInfo.pixel_size_y || 1.0;
  this.imageInfo.pixel_size_z = imageInfo.pixel_size_z || 1.0;

  this.pixel_size = [
    this.imageInfo.pixel_size_x,
    this.imageInfo.pixel_size_y,
    this.imageInfo.pixel_size_z
  ];
  this.x = imageInfo.tile_width;
  this.y = imageInfo.tile_height;
  this.z = imageInfo.tiles;
  this.t = 1;


  this.num_channels = imageInfo.channels;
  
  this.channel_names = this.imageInfo.channel_names.slice();
  this.channel_colors_default = imageInfo.channel_colors ? imageInfo.channel_colors.slice() : this.channel_names.map((name, index) => getColorByChannelIndex(index));
  this.channel_colors = this.channel_colors_default.slice();

  this.fusion = this.channel_colors.map((col, index) => {
    let rgbColor;
    // take copy of original channel color
    if (col[0] === 0 && col[1] === 0 && col[2] === 0) {
      rgbColor = 0;
    } else {
      rgbColor = [col[0], col[1], col[2]];
    }
    return {
      chIndex: index,
      lut:[],
      rgbColor: rgbColor
    };
  });

  this.bounds = {
    bmin: new THREE.Vector3(-0.5, -0.5, -0.5),
    bmax: new THREE.Vector3(0.5, 0.5, 0.5)
  };

  this.channelData = new AICSchannelData({
    count: this.num_channels,
    atlasSize:[this.imageInfo.atlas_width, this.imageInfo.atlas_height],
    volumeSize:[this.imageInfo.tile_width, this.imageInfo.tile_height, this.z],
    channelNames:this.channel_names
  }, this.redraw, this.onChannelLoaded.bind(this));

}

AICSvolume.prototype.getIntensity = function(c, x, y, z) {
  return this.channelData.channels[c].getIntensity(x,y,z);
};

/**
 * Set clipping range (between 0 and 1) for a given axis.
 * @param {number} axis 0, 1, or 2 for x, y, or z axis
 * @param {number} minval 0..1, should be less than maxval
 * @param {number} maxval 0..1, should be greater than minval 
 * @param {boolean} isOrthoAxis is this an orthographic projection or just a clipping of the range for perspective view
 */
AICSvolume.prototype.setAxisClip = function(axis, minval, maxval, isOrthoAxis) {
  this.bounds.bmax[axis] = maxval;
  this.bounds.bmin[axis] = minval;
};

AICSvolume.prototype.cleanup = function() {
  this.channelData.cleanup();
};

/**
 * @return a reference to the list of channel names
 */
AICSvolume.prototype.channelNames = function() {
  return this.channel_names;
};

AICSvolume.prototype.getChannel = function(channelIndex) {
  return this.channelData.channels[channelIndex];
};

AICSvolume.prototype.onChannelLoaded = function(batch) {
  for (var j = 0; j < batch.length; ++j) {
    var idx = batch[j];
    if (this.onChannelDataReadyCallback) {
      this.onChannelDataReadyCallback(idx);
    }
  }
};

/**
 * Hide or display volume data for a channel
 * @param {number} channelIndex 
 * @param {boolean} enabled 
 */
AICSvolume.prototype.setVolumeChannelEnabled = function(channelIndex, enabled) {
  // flip the color to the "null" value
  this.fusion[channelIndex].rgbColor = enabled ? this.channel_colors[channelIndex] : 0;
};

/**
 * Set the color for a channel
 * @param {number} channelIndex 
 * @param {Array.<number>} colorrgba [r,g,b]
 */
AICSvolume.prototype.updateChannelColor = function(channelIndex, colorrgba) {
  if (!this.channel_colors[channelIndex]) {
    return;
  }
  this.channel_colors[channelIndex] = colorrgba;
  // if volume channel is zero'ed out, then don't update it until it is switched on again.
  if (this.fusion[channelIndex].rgbColor !== 0) {
    this.fusion[channelIndex].rgbColor = colorrgba;
  }
};

/**
 * Assign volume data via a 2d array containing the z slices as tiles across it.  Assumes that the incoming data is consistent with the image's pre-existing imageInfo tile metadata.
 * @param {number} channelIndex 
 * @param {Uint8Array} atlasdata 
 * @param {number} atlaswidth 
 * @param {number} atlasheight 
 */
AICSvolume.prototype.setChannelDataFromAtlas = function(channelIndex, atlasdata, atlaswidth, atlasheight) {
  this.channelData.channels[channelIndex].setBits(atlasdata, atlaswidth, atlasheight);
  this.channelData.channels[channelIndex].unpackVolume(this.channelData.options);  
  this.channelData.onChannelLoaded.call(this.channelData, [channelIndex]);
};

// ASSUMES that this.channelData.options is already set and incoming data is consistent with it
/**
 * Assign volume data as a 3d array ordered x,y,z. The xy size must be equal to tilewidth*tileheight from the imageInfo used to construct this AICSvolumeDrawable.  Assumes that the incoming data is consistent with the image's pre-existing imageInfo tile metadata.
 * @param {number} channelIndex 
 * @param {Uint8Array} volumeData 
 */
AICSvolume.prototype.setChannelDataFromVolume = function(channelIndex, volumeData) {
  this.channelData.channels[channelIndex].setFromVolumeData(volumeData, this.channelData.options);
  this.channelData.onChannelLoaded.call(this.channelData, [channelIndex]);
};

// TODO: decide if this should update imageInfo or not. For now, leave imageInfo alone as the "original" data
/**
 * Add a new channel ready to receive data from one of the setChannelDataFrom* calls.
 * Name and color will be defaulted if not provided. For now, leave imageInfo alone as the "original" data
 * @param {string} name 
 * @param {Array.<number>} color [r,g,b]
 */
AICSvolume.prototype.appendEmptyChannel = function(name, color) {
  let idx = this.num_channels;
  let chname = name  || "channel_"+idx;
  let chcolor = color || getColorByChannelIndex(idx);
  this.num_channels += 1;
  this.channel_names.push(chname);
  this.channel_colors_default.push(chcolor);
  this.channel_colors.push(chcolor);
  this.fusion.push({
    chIndex: idx,
    lut:[],
    rgbColor: chcolor
  });

  this.channelData.appendEmptyChannel(chname);

  return idx;
};

export default AICSvolume;
