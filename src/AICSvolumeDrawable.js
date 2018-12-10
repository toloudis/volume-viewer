import AICSchannelData from './AICSchannelData.js';
import AICSvolume from './AICSvolume.js';
import FileSaver from './FileSaver.js';
import { getColorByChannelIndex } from './constants/colors.js';
import { defaultMaterialSettings } from './constants/materials.js';
import { 
  rayMarchingVertexShaderSrc, 
  rayMarchingFragmentShaderSrc, 
  rayMarchingShaderUniforms 
} from './constants/volumeRayMarchShader.js';
import './MarchingCubes.js';
import NaiveSurfaceNets from './NaiveSurfaceNets.js';
import './STLBinaryExporter.js';

import 'three/examples/js/exporters/GLTFExporter.js';


/**
 * A renderable multichannel volume image with 8-bits per channel intensity values.
 * @class
 * @param {imageInfo} imageInfo 
 */
function AICSvolumeDrawable(imageInfo) {
  
  this.volume = new AICSvolume(imageInfo);
  this.onChannelDataReadyCallback = null;

  this.channel_colors = this.volume.channel_colors_default.slice();

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

  this.sceneRoot = new THREE.Object3D();//create an empty container

  this.cube = new THREE.BoxGeometry(1.0, 1.0, 1.0);
  this.cubeMesh = new THREE.Mesh(this.cube);
  this.cubeMesh.name = "Volume";

  this.meshRoot = new THREE.Object3D();//create an empty container
  this.meshRoot.name = "Mesh Surface Container";

  // draw meshes first, and volume last, for blending and depth test reasons
  this.sceneRoot.add(this.meshRoot);
  this.sceneRoot.add(this.cubeMesh);

  this.meshrep = [];

  this.bounds = {
    bmin: new THREE.Vector3(-0.5, -0.5, -0.5),
    bmax: new THREE.Vector3(0.5, 0.5, 0.5)
  };

  this.uniforms = rayMarchingShaderUniforms;

  // shader,vtx and frag.
  var vtxsrc = rayMarchingVertexShaderSrc;
  var fgmtsrc = rayMarchingFragmentShaderSrc;

  var threeMaterial = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: vtxsrc,
    fragmentShader: fgmtsrc,
    transparent: true,
    depthTest: false
  });
  this.cubeMesh.material = threeMaterial;


  this.setUniform("ATLAS_X", this.volume.imageInfo.cols);
  this.setUniform("ATLAS_Y", this.volume.imageInfo.rows);
  this.setUniform("SLICES", this.volume.z);

  var cx = 0.0;
  var cz = 0.0;
  var cy = 0.0;
  this.sceneRoot.position.set(cx,cy,cz);
  this.maxSteps = 256;

  this.setScale(this.volume.scale);

  this.channelData = new AICSchannelData(
    this.volume.imageInfo.atlas_width, 
    this.volume.imageInfo.atlas_height, 
    this.redraw
  );
}

/**
 * Assign volume data via a 2d array containing the z slices as tiles across it.  Assumes that the incoming data is consistent with the image's pre-existing imageInfo tile metadata.
 * @param {number} channelIndex 
 * @param {Uint8Array} atlasdata 
 * @param {number} atlaswidth 
 * @param {number} atlasheight 
 */
AICSvolumeDrawable.prototype.setChannelDataFromAtlas = function(channelIndex, atlasdata, atlaswidth, atlasheight) {
  this.volume.setChannelDataFromAtlas(channelIndex, atlasdata, atlaswidth, atlasheight);
  this.onChannelLoaded([channelIndex]);
};

/**
 * Assign volume data as a 3d array ordered x,y,z. The xy size must be equal to tilewidth*tileheight from the imageInfo used to construct this AICSvolume.  Assumes that the incoming data is consistent with the image's pre-existing imageInfo tile metadata.
 * @param {number} channelIndex 
 * @param {Uint8Array} volumeData 
 */
AICSvolumeDrawable.prototype.setChannelDataFromVolume = function(channelIndex, volumeData) {
  this.volume.setChannelDataFromVolume(channelIndex, volumeData);
  this.onChannelLoaded([channelIndex]);
};

AICSvolumeDrawable.prototype.resetSampleRate = function() {
  this.steps = this.maxSteps / 2;
};

AICSvolumeDrawable.prototype.setMaxSampleRate = function(qual) {
  this.maxSteps = qual;
  this.setUniform('maxSteps', qual);
};

AICSvolumeDrawable.prototype.setScale = function(scale) {

  this.scale = scale;

  this.currentScale = scale.clone();

  this.meshRoot.scale.copy(new THREE.Vector3(0.5 * scale.x,
    0.5 * scale.y,
    0.5 * scale.z));

  this.cubeMesh.scale.copy(new THREE.Vector3(scale.x,
    scale.y,
    scale.z));


  this.cubeMesh.updateMatrixWorld(true);
  var mi = new THREE.Matrix4();
  mi.getInverse(this.cubeMesh.matrixWorld);
  this.setUniformNoRerender('inverseModelViewMatrix', mi, true, true);
};

AICSvolumeDrawable.prototype.setUniform = function(name, value) {
  this.setUniformNoRerender(name, value);
};

AICSvolumeDrawable.prototype.setUniformNoRerender = function(name, value) {
  if (!this.uniforms[name]) {
    return;
  }
  this.uniforms[name].value = value;
  //this.uniforms[name].needsUpdate = true;
  //this.cubeMesh.material.uniforms[name].value = value;
  this.cubeMesh.material.needsUpdate = true;
};

AICSvolumeDrawable.prototype.initResolution = function(canvas) {
  var res = new THREE.Vector2(canvas.getWidth(), canvas.getHeight());
  this.initUniform('iResolution', "v2", res);
};

AICSvolumeDrawable.prototype.setResolution = function(viewObj) {
  var res = new THREE.Vector2(viewObj.getWidth(), viewObj.getHeight());
  this.setUniform('iResolution', res);
};

// TODO handle this differently in 3D mode vs 2D mode?
/**
 * Set clipping range (between 0 and 1) for a given axis.
 * @param {number} axis 0, 1, or 2 for x, y, or z axis
 * @param {number} minval 0..1, should be less than maxval
 * @param {number} maxval 0..1, should be greater than minval 
 * @param {boolean} isOrthoAxis is this an orthographic projection or just a clipping of the range for perspective view
 */
AICSvolumeDrawable.prototype.setAxisClip = function(axis, minval, maxval, isOrthoAxis) {
  this.bounds.bmax[axis] = maxval;
  this.bounds.bmin[axis] = minval;

  if (isOrthoAxis) {
    const thicknessPct = maxval - minval;
    this.setUniformNoRerender('orthoThickness', thicknessPct);
  }

  this.setUniformNoRerender('AABB_CLIP_MIN', this.bounds.bmin);
  this.setUniform('AABB_CLIP_MAX', this.bounds.bmax);
};

AICSvolumeDrawable.prototype.setOrthoThickness = function(value) {
  this.setUniformNoRerender('orthoThickness', value);
};

AICSvolumeDrawable.prototype.onAnimate = function(canvas) {
  this.cubeMesh.updateMatrixWorld(true);

  // TODO: this is inefficient, as this work is duplicated by threejs.
  canvas.camera.updateMatrixWorld(true);
  canvas.camera.matrixWorldInverse.getInverse( canvas.camera.matrixWorld );

  var mvm = new THREE.Matrix4();
  mvm.multiplyMatrices(canvas.camera.matrixWorldInverse, this.cubeMesh.matrixWorld);
  var mi = new THREE.Matrix4();
  mi.getInverse(mvm);

  this.setUniform('inverseModelViewMatrix', mi, true, true);

  const isVR = canvas.isVR();
  if (isVR) {
    // raise volume drawable to about 1 meter.
    this.sceneRoot.position.y = 1.0;
    
    this.cubeMesh.material.depthWrite = true;
    this.cubeMesh.material.transparent = false;
    this.cubeMesh.material.depthTest = true;
  }
  else {
    this.sceneRoot.position.y = 0.0;
    this.cubeMesh.material.depthWrite = false;
    this.cubeMesh.material.transparent = true;
    this.cubeMesh.material.depthTest = false;
  }
};

AICSvolumeDrawable.prototype.updateMeshColors = function() {
  for (var i = 0; i < this.num_channels; ++i) {
    if (this.meshrep[i]) {
      var rgb = this.channel_colors[i];
      const c = (rgb[0] << 16) | (rgb[1] << 8) | (rgb[2]);

      this.meshrep[i].traverse(function(child) {
        if (child instanceof THREE.Mesh) {
          child.material.color = new THREE.Color(c);
        }
      });
      if (this.meshrep[i].material) {
        this.meshrep[i].material.color = new THREE.Color(c);
      }
    }
  }
};

AICSvolumeDrawable.prototype.createMaterialForChannel = function(channelIndex, alpha, transp) {
  let rgb = this.channel_colors[channelIndex];
  const col = (rgb[0] << 16) | (rgb[1] << 8) | (rgb[2]);
  const material = new THREE.MeshPhongMaterial({
    color: new THREE.Color(col),
    shininess: defaultMaterialSettings.shininess,
    specular: new THREE.Color(defaultMaterialSettings.specularColor),
    opacity: alpha,
    transparent: (alpha < 0.9)
  });
  return material;
};

AICSvolumeDrawable.prototype.generateIsosurfaceGeometry = function(channelIndex, isovalue) {
  if (!this.volume) {
    return [];
  }
  const volumedata = this.volume.channels[channelIndex].volumeData;

  const marchingcubes = true;

  if (marchingcubes) {
    let effect = new THREE.MarchingCubes(
      [this.imageInfo.tile_width, this.imageInfo.tile_height, this.z],
      null,
      false, false, true,
      volumedata
    );
    effect.position.set( 0, 0, 0 );
    effect.scale.set( 0.5 * this.scale.x, 0.5 * this.scale.y, 0.5 * this.scale.z );
    effect.isovalue = isovalue;
    var geometries = effect.generateGeometry();
    // TODO: weld vertices and recompute normals.  MarchingCubes results in excessive coincident verts
    // for (var i = 0; i < geometries.length; ++i) {
    //   var g = new THREE.Geometry().fromBufferGeometry(geometries[i]);
    //   g.mergeVertices();
    //   geometries[i] = new THREE.BufferGeometry().fromGeometry(g);
    //   geometries[i].computeVertexNormals();
    // }
    return geometries;
  }
  else {
    var result = NaiveSurfaceNets.surfaceNets(
      volumedata,
      [this.imageInfo.tile_width, this.imageInfo.tile_height, this.z],
      isovalue
    );
    return NaiveSurfaceNets.constructTHREEGeometry(result);
  }

};


AICSvolumeDrawable.prototype.createMeshForChannel = function(channelIndex, isovalue, alpha, transp) {
  const geometries = this.generateIsosurfaceGeometry(channelIndex, isovalue);
  const material = this.createMaterialForChannel(channelIndex, alpha, transp);

  let theObject = new THREE.Object3D();
  theObject.name = "Channel"+channelIndex;
  theObject.userData = {isovalue:isovalue};
  // proper scaling will be done in parent object
  for (var i = 0; i < geometries.length; ++i) {
    let mesh = new THREE.Mesh( geometries[i], material );
    theObject.add(mesh);
  }
  return theObject;
};

/**
 * If an isosurface exists, update its isovalue and regenerate the surface. Otherwise do nothing.
 * @param {number} channel 
 * @param {number} value 
 */
AICSvolumeDrawable.prototype.updateIsovalue = function(channel, value) {
  if (!this.meshrep[channel]) {
    return;
  }
  if (this.meshrep[channel].userData.isovalue === value) {
    return;
  }

  // find the current isosurface opacity.
  let opacity = 1;
  if (this.meshrep[channel].material) {
    opacity = this.meshrep[channel].material.opacity;
  }
  else {
    this.meshrep[channel].traverse(function(child) {
      if (child instanceof THREE.Mesh) {
        opacity = child.material.opacity;
      }
    });
  }

  this.destroyIsosurface(channel);

  this.meshrep[channel] = this.createMeshForChannel(channel, value, opacity, false);

  this.meshRoot.add(this.meshrep[channel]);
};

/**
 * 
 * @param {number} channel 
 * @return {number} the isovalue for this channel or undefined if this channel does not have an isosurface created
 */
AICSvolumeDrawable.prototype.getIsovalue = function(channel) {
  if (!this.meshrep[channel]) {
    return undefined;
  }
  return this.meshrep[channel].userData.isovalue;
};

/**
 * Set opacity for isosurface
 * @param {number} channel 
 * @param {number} value Opacity
 */
AICSvolumeDrawable.prototype.updateOpacity = function(channel, value) {
  if (!this.meshrep[channel]) {
    return;
  }

  this.meshrep[channel].traverse(function(child) {
    if (child instanceof THREE.Mesh) {
      child.material.opacity = value;
      child.material.transparent = (value < 0.9);
      //child.material.depthWrite = !child.material.transparent;
    }
  });
  if (this.meshrep[channel].material) {
    this.meshrep[channel].material.opacity = value;
    this.meshrep[channel].material.transparent = (value < 0.9);
    //this.meshrep[channel].material.depthWrite = !this.meshrep[channel].material.transparent;
  }
};

/**
 * 
 * @param {number} channel 
 * @return true if there is currently a mesh isosurface for this channel
 */
AICSvolumeDrawable.prototype.hasIsosurface = function(channel) {
  return (!!this.meshrep[channel]);
};

/**
 * If an isosurface is not already created, then create one.  Otherwise do nothing.
 * @param {number} channel 
 * @param {number} value isovalue
 * @param {number=} alpha Opacity
 * @param {boolean=} transp render surface as transparent object
 */
AICSvolumeDrawable.prototype.createIsosurface = function(channel, value, alpha, transp) {
  if (!this.meshrep[channel]) {
    if (alpha === undefined) {
      alpha = 1.0;
    }
    if (transp === undefined) {
      transp = (alpha < 0.9);
    }
    this.meshrep[channel] = this.createMeshForChannel(channel, value, alpha, transp);
    this.meshRoot.add(this.meshrep[channel]);
  }
};

AICSvolumeDrawable.prototype.destroyIsosurface = function(channel) {
  if (this.meshrep[channel]) {
    this.meshRoot.remove(this.meshrep[channel]);
    this.meshrep[channel].traverse(function(child) {
      if (child instanceof THREE.Mesh) {
        child.material.dispose();
        child.geometry.dispose();
      }
    });
    if (this.meshrep[channel].geometry) {
      this.meshrep[channel].geometry.dispose();
    }
    if (this.meshrep[channel].material) {
      this.meshrep[channel].material.dispose();
    }
    this.meshrep[channel] = null;
  }
};

AICSvolumeDrawable.prototype.fuse = function() {
  if (!this.volume) {
    return;
  }
  //if (!this.volume.loaded) {
  //	return;
  //}

  //'m' for max or 'a' for avg
  var fusionType = 'm';
  this.channelData.fuse(this.fusion, fusionType, this.volume.channels);

  // update to fused texture
  this.setUniform('textureAtlas', this.channelData.fusedTexture);
  this.setUniform('textureAtlasMask', this.channelData.maskTexture);

  if (this.redraw) {
    this.redraw();
  }

};

AICSvolumeDrawable.prototype.setVoxelSize = function(values) {
  // basic error check.  bail out if we get something bad.
  if (!values.length || values.length < 3) {
    return;
  }

  // only set the data if it is > 0.  zero is not an allowed value.
  if (values[0] > 0) {
    this.pixel_size[0] = values[0];
  }
  if (values[1] > 0) {
    this.pixel_size[1] = values[1];
  }
  if (values[2] > 0) {
    this.pixel_size[2] = values[2];
  }

  var physSizeMin = Math.min(this.pixel_size[0], Math.min(this.pixel_size[1], this.pixel_size[2]));
  var pixelsMax = Math.max(this.imageInfo.width, Math.max(this.imageInfo.height,this.z));
  var sx = this.pixel_size[0]/physSizeMin * this.imageInfo.width/pixelsMax;
  var sy = this.pixel_size[1]/physSizeMin * this.imageInfo.height/pixelsMax;
  var sz = this.pixel_size[2]/physSizeMin * this.z/pixelsMax;

  this.setScale(new THREE.Vector3(sx,sy,sz));

};

AICSvolumeDrawable.prototype.cleanup = function() {
  for (var i = 0; i < this.num_channels; ++i) {
    this.destroyIsosurface(i);
  }

  this.cube.dispose();
  this.cubeMesh.material.dispose();

  this.channelData.cleanup();
  this.channelData.fusedTexture.dispose();
  this.channelData.maskTexture.dispose();
};

/**
 * @return a reference to the list of channel names
 */
AICSvolumeDrawable.prototype.channelNames = function() {
  return this.channel_names;
};

AICSvolumeDrawable.prototype.getChannel = function(channelIndex) {
  return this.volume.getChannel(channelIndex);
};

AICSvolumeDrawable.prototype.onChannelLoaded = function(batch) {
  // tell the fuse workers that new channel data arrived
  this.channelData.onChannelLoaded(batch, this.volume.channels);

  // any channels not yet loaded must just be set to 0 color for this fuse.
  this.fuse();

  for (var j = 0; j < batch.length; ++j) {
    var idx = batch[j];
    // if an isosurface was created before the channel data arrived, we need to re-calculate it now.
    if (this.meshrep[idx]) {
      this.updateIsovalue(idx, this.getIsovalue(idx));
    }
  }

  // let the outside world have a chance
  if (this.onChannelDataReadyCallback) {
    this.onChannelDataReadyCallback();
  }
};

/**
 * Save a channel's isosurface as a triangle mesh to either STL or GLTF2 format.  File will be named automatically, using image name and channel name.
 * @param {number} channelIndex 
 * @param {string} type Either 'GLTF' or 'STL'
 */
AICSvolumeDrawable.prototype.saveChannelIsosurface = function(channelIndex, type) {
  if (!this.meshrep[channelIndex]) {
    return;
  }

  if (type === "STL") {
    this.exportSTL(this.meshrep[channelIndex], this.name+"_"+this.channel_names[channelIndex]);
  }
  else if (type === "GLTF") {
    // temporarily set other meshreps to invisible
    var prevviz = [];
    for (var i = 0; i < this.meshrep.length; ++i) {
      if (this.meshrep[i]) {
          prevviz[i] = this.meshrep[i].visible;
          this.meshrep[i].visible = (i === channelIndex);
        }
    }
    this.exportGLTF(this.meshRoot, this.name+"_"+this.channel_names[channelIndex]);
    for (var i = 0; i < this.meshrep.length; ++i) {
      if (this.meshrep[i]) {
        this.meshrep[i].visible = prevviz[i];
      }
    }
  }
};

AICSvolumeDrawable.prototype.exportSTL = function( input, fname ) {
  var ex = new THREE.STLBinaryExporter();
  var output = ex.parse(input);
  FileSaver.saveBinary(output.buffer, fname+'.stl');
};

// takes a scene or object or array of scenes or objects or both!
AICSvolumeDrawable.prototype.exportGLTF = function( input, fname ) {
  var gltfExporter = new THREE.GLTFExporter();
  var options = {
    // transforms as translate rotate scale?
    trs: false,
    onlyVisible: true,
    truncateDrawRange: true,
    binary: true,
    forceIndices: false,
    forcePowerOfTwoTextures: true
  };
  gltfExporter.parse( input, function( result ) {
    if ( result instanceof ArrayBuffer ) {
      FileSaver.saveArrayBuffer( result, fname + '.glb' );
    } else {
      var output = JSON.stringify( result, null, 2 );
      FileSaver.saveString( output, fname + '.gltf' );
    }
  }, options );
};

/**
 * Hide or display volume data for a channel
 * @param {number} channelIndex 
 * @param {boolean} enabled 
 */
AICSvolumeDrawable.prototype.setVolumeChannelEnabled = function(channelIndex, enabled) {
  // flip the color to the "null" value
  this.fusion[channelIndex].rgbColor = enabled ? this.channel_colors[channelIndex] : 0;
  // if all are nulled out, then hide the volume element from the scene.
  if (this.fusion.every((elem)=>(elem.rgbColor === 0))) {
    this.cubeMesh.visible = false;
  }
  else {
    this.cubeMesh.visible = true;
  }
};

/**
 * Is a the volume data for a channel being shown?
 * @param {number} channelIndex 
 */
AICSvolumeDrawable.prototype.isVolumeChannelEnabled = function(channelIndex) {
  // the zero value for the fusion rgbColor is the indicator that a channel is hidden.
  return this.fusion[channelIndex].rgbColor !== 0;
};

/**
 * Set the color for a channel
 * @param {number} channelIndex 
 * @param {Array.<number>} colorrgba [r,g,b]
 */
AICSvolumeDrawable.prototype.updateChannelColor = function(channelIndex, colorrgba) {
  if (!this.channel_colors[channelIndex]) {
    return;
  }
  this.channel_colors[channelIndex] = colorrgba;
  // if volume channel is zero'ed out, then don't update it until it is switched on again.
  if (this.fusion[channelIndex].rgbColor !== 0) {
    this.fusion[channelIndex].rgbColor = colorrgba;
    this.fuse();
  }
  this.updateMeshColors();
};

/**
 * Set the global density of the volume data
 * @param {number} density Roughly equivalent to opacity, or how translucent or opaque the volume is
 * @param {boolean=} no_redraw Set to true to delay re-rendering. Otherwise ignore.
 */
AICSvolumeDrawable.prototype.setDensity = function(density, no_redraw) {
  if (no_redraw) {
    this.setUniformNoRerender("DENSITY", density);
  }
  else {
    this.setUniform("DENSITY", density);
  }
};

/**
 * Get the global density of the volume data
 */
AICSvolumeDrawable.prototype.getDensity = function() {
  return this.uniforms["DENSITY"].value;
};

/**
 * Set the global brightness of the volume data
 * @param {number} brightness Roughly speaking, an intensity multiplier on the whole volume
 * @param {boolean=} no_redraw Set to true to delay re-rendering. Otherwise ignore.
 */
AICSvolumeDrawable.prototype.setBrightness = function(brightness, no_redraw) {
  if (no_redraw) {
    this.setUniformNoRerender("BRIGHTNESS", brightness);
  }
  else {
    this.setUniform("BRIGHTNESS", brightness);
  }
};

/**
 * Get the global brightness of the volume data
 */
AICSvolumeDrawable.prototype.getBrightness = function() {
  return this.uniforms["BRIGHTNESS"].value;
};

/**
 * Add a new channel ready to receive data from one of the setChannelDataFrom* calls.
 * Name and color will be defaulted if not provided. For now, leave imageInfo alone as the "original" data
 * @param {string} name 
 * @param {Array.<number>} color [r,g,b]
 */
AICSvolumeDrawable.prototype.appendEmptyChannel = function(name, color) {
  let idx = this.num_channels;
  let chcolor = color || getColorByChannelIndex(idx);
  this.channel_colors.push(chcolor);
  this.fusion.push({
    chIndex: idx,
    lut:[],
    rgbColor: chcolor
  });

  this.channelData.appendEmptyChannel(chname);

  return idx;
};

/**
 * Assign a channel index as a mask channel (will multiply its color against the entire visible volume)
 * @param {number} channelIndex 
 */
AICSvolumeDrawable.prototype.setChannelAsMask = function(channelIndex) {
  return this.channelData.setChannelAsMask(channelIndex);
};

/**
 * Get a value from the volume data
 * @return {number} the intensity value from the given channel at the given xyz location
 * @param {number} c The channel index
 * @param {number} x 
 * @param {number} y 
 * @param {number} z 
 */
AICSvolumeDrawable.prototype.getIntensity = function(c, x, y, z) {
  return this.volume.getIntensity(c, x, y, z);
};

export default AICSvolumeDrawable;
