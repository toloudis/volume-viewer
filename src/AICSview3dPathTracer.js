import {AICSthreeJsPanel} from './AICSthreeJsPanel.js';
import lightSettings from './constants/lights.js';
import {pathTracingFragmentShaderSrc, pathTracingUniforms, pathTracingVertexShaderSrc} from './constants/volumePTshader.js';

//let randomVector = new THREE.Vector3();

/**
 * @class
 */
export class AICSview3d_PT {
  /**
   * @param {HTMLElement} parentElement the 3d display will try to fill the parent element.
   */
  constructor(parentElement) {
    this.canvas3d = new AICSthreeJsPanel(parentElement, true);
    this.redraw = this.redraw.bind(this);
    this.scene = null;
    this.backgroundColor = 0x000000;

    // a light source...
    //this.light = null;

    this.loaded = false;
    let that = this;
    this.parentEl = parentElement;
    window.addEventListener('resize', () => that.resize(null, that.parentEl.offsetWidth, that.parentEl.offsetHeight));

    this.cameraIsMoving = false;
    this.cameraJustStartedMoving = false;
    this.cameraRecentlyMoving = false;
    this.sampleCounter = 1;
    this.frameCounter = 1;

    this.buildScene();
  }

  preRender() {
    if (this.scene.getObjectByName('lightContainer')) {
      this.scene.getObjectByName('lightContainer').rotation.setFromRotationMatrix(this.canvas3d.camera.matrixWorld);
    }
    // keep the ortho scale up to date.
    if (this.image && this.canvas3d.camera.isOrthographicCamera) {
      this.image.setUniformNoRerender('orthoScale', this.canvas3d.controls.scale);
    }
  };

  renderScene() {
    if (!this.volumeTexture) {
      return;
    }

    // if (this.sampleCounter === 1) {
    //   this.canvas3d.renderer.setRenderTarget(this.screenTextureRenderTarget);
    //   this.canvas3d.renderer.clear(true);
    //   this.canvas3d.renderer.setRenderTarget(this.pathTracingRenderTarget);
    //   this.canvas3d.renderer.clear(true);
    // }


    if ( this.cameraIsMoving ) {
					
      this.sampleCounter = 1.0;
      this.frameCounter  += 1.0;
      
      if ( !this.cameraRecentlyMoving ) {
        this.cameraJustStartedMoving = true;
        this.cameraRecentlyMoving = true;
      }
    }
    
    if ( !this.cameraIsMoving ) {

      this.sampleCounter += 1.0;
      this.frameCounter  += 1.0;
      if (this.cameraRecentlyMoving) {
        this.frameCounter = 1.0;
      }
      
      this.cameraRecentlyMoving = false;
      
    }



    this.pathTracingUniforms.uCameraIsMoving.value = this.cameraIsMoving;
    this.pathTracingUniforms.uCameraJustStartedMoving.value = this.cameraJustStartedMoving;
    this.pathTracingUniforms.uSampleCounter.value = this.sampleCounter;
    this.pathTracingUniforms.uFrameCounter.value = this.frameCounter;
    //this.pathTracingUniforms.uRandomVector.value = randomVector.set( Math.random(), Math.random(), Math.random() );
    // CAMERA
    // force the perspective camera to update its world matrix.
    this.canvas3d.perspectiveCamera.updateMatrixWorld(true);			
    //this.pathTracingUniforms.uCameraMatrix.value.copy( this.canvas3d.perspectiveCamera.matrixWorld );

    const cam = this.canvas3d.perspectiveCamera;
    this.pathTracingUniforms.gCamera.value.m_From.copy(cam.position);
    this.pathTracingUniforms.gCamera.value.m_N.subVectors(this.canvas3d.controls.target, cam.position).normalize();
    this.pathTracingUniforms.gCamera.value.m_U.crossVectors(this.pathTracingUniforms.gCamera.value.m_N, cam.up).normalize();
    this.pathTracingUniforms.gCamera.value.m_V.crossVectors(this.pathTracingUniforms.gCamera.value.m_U, this.pathTracingUniforms.gCamera.value.m_N).normalize();

    const Scale = Math.tan(0.5 * (cam.fov * 3.14159265/180.0));
    const aspect = this.pathTracingUniforms.uResolution.value.x/this.pathTracingUniforms.uResolution.value.y;
    this.pathTracingUniforms.gCamera.value.m_Screen.set(
      -Scale * aspect,
      Scale * aspect,
      // the "0" Y pixel will be at +Scale.
      Scale,
      -Scale
    );
    const scr = this.pathTracingUniforms.gCamera.value.m_Screen;
    this.pathTracingUniforms.gCamera.value.m_InvScreen.set(
      // the amount to increment for each pixel
      (scr.y - scr.x) / this.pathTracingUniforms.uResolution.value.x,
      (scr.w - scr.z) / this.pathTracingUniforms.uResolution.value.y
    );
    this.pathTracingUniforms.volumeTexture.value = this.volumeTexture;


    this.screenOutputMaterial.uniforms.uOneOverSampleCounter.value = 1.0 / this.sampleCounter;
    
    // RENDERING in 3 steps
    
    // STEP 1
    // Perform PathTracing and Render(save) into pathTracingRenderTarget
    // Read previous screenTextureRenderTarget to use as a new starting point to blend with
    this.canvas3d.renderer.render( this.pathTracingScene, this.canvas3d.perspectiveCamera, this.pathTracingRenderTarget );	
    
    // STEP 2
    // Render(copy) the final pathTracingScene output(above) into screenTextureRenderTarget
    // This will be used as a new starting point for Step 1 above
    this.canvas3d.renderer.render( this.screenTextureScene, this.quadCamera, this.screenTextureRenderTarget );
    
    // STEP 3
    // Render full screen quad with generated pathTracingRenderTarget in STEP 1 above.
    // After the image is gamma corrected, it will be shown on the screen as the final accumulated output
    // DMT - this step is handled by the threeJsPanel. 
    // tell the threejs panel to use the quadCamera to render this scene.

    //renderer.render( this.screenOutputScene, this.quadCamera );    
  };

  /**
   * Force a redraw.  This is generally not needed because of constant redraws in the main animation loop.
   */
  redraw() {
    this.canvas3d.rerender();
  };

  destroyImage() {
    if (this.image) {
      if (this.volumeTexture) {
        this.volumeTexture.dispose();
        this.volumeTexture = null;
      }
      this.canvas3d.animate_funcs = [];
      this.scene.remove(this.image.sceneRoot);
      this.image.cleanup();
      this.image = null;
    }
  }

  onStartControls() {
    this.cameraIsMoving = true;
  }
  onChangeControls() {
    //this.cameraIsMoving = true;
  }
  onEndControls() {
    this.cameraIsMoving = false;
    this.sampleCounter = 0.0;
  }

  /**
   * Add a new volume image to the viewer.  The viewer currently only supports a single image at a time, and will destroy any prior existing image.
   * @param {AICSvolumeDrawable} img 
   */
  setImage(img) {
    this.destroyImage();

    this.image = img;
    this.image.redraw = this.redraw.bind(this);

    //this.scene.add(img.sceneRoot);

    this.image.setResolution(this.canvas3d);

    var that = this;
    this.image.onChannelDataReadyCallback = function () {
        const volume = that.image.volume;
        // if all channels are loaded...
        if (volume.loaded && !that.volumeTexture) {
          that.image.onChannelDataReadyCallback = null;

          if (volume.imageInfo.preset) {
            let p = volume.imageInfo.preset;
            for (var i = 0; i < that.image.volume.num_channels; ++i) {
              if (p[i]) {
                volume.channels[i].lutGenerator_windowLevel(p[i][0], p[i][1]);
              }
            }
          }

          that.pathTracingUniforms.g_nChannels.value = 4;
          that.viewChannels = [0, 1, 2, 3];

          // create volume texture
          var sx = volume.x,
            sy = volume.y,
            sz = volume.z;
          var data = new Uint8Array(sx * sy * sz * 4);
          data.fill(0);
          // defaults to rgba and unsignedbytetype so dont need to supply format this time.
          that.volumeTexture = new THREE.DataTexture3D(data, volume.x, volume.y, volume.z);
          that.volumeTexture.minFilter = that.volumeTexture.magFilter = THREE.LinearFilter;
          that.volumeTexture.needsUpdate = true;
          that.pathTracingUniforms.volumeTexture.value = that.volumeTexture;

          console.log("GOT VOLUME TEXTURE");

          // create Lut textures
          for (var i = 0; i < 4; ++i) {
            // empty array
            var lutData = new Uint8Array(256).fill(1);
            const lut0 = new THREE.DataTexture(lutData, 256, 1, THREE.RedFormat, THREE.UnsignedByteType);
            lut0.needsUpdate = true;
            that.pathTracingUniforms.g_lutTexture.value[i] = lut0;
          }

          // bounds will go from 0 to PhysicalSize
          const PhysicalSize = volume.normalizedPhysicalSize;
          let bbctr = new THREE.Vector3(PhysicalSize.x * 0.5, PhysicalSize.y * 0.5, PhysicalSize.z * 0.5);

          if (that.controlStartHandler) {
            that.canvas3d.controls.removeEventListener('start', that.controlStartHandler);
          }
          if (that.controlChangeHandler) {
            that.canvas3d.controls.removeEventListener('change', that.controlChangeHandler);
          }
          if (that.controlEndHandler) {
            that.canvas3d.controls.removeEventListener('end', that.controlEndHandler);
          }

          // put the camera pointing at the center of this thing.
          that.canvas3d.perspectiveCamera.position.set(bbctr.x, bbctr.y, bbctr.z + 2.75);
          that.canvas3d.perspectiveCamera.lookAt(bbctr);
          that.canvas3d.perspectiveControls.target.set(bbctr.x, bbctr.y, bbctr.z);
          that.canvas3d.perspectiveControls.update();

          that.controlStartHandler = that.onStartControls.bind(that);
          that.canvas3d.controls.addEventListener('start', that.controlStartHandler);
          // that.controlChangeHandler = that.onChangeControls.bind(that);
          // that.canvas3d.controls.addEventListener('change', that.controlChangeHandler);
          that.controlEndHandler = that.onEndControls.bind(that);
          that.canvas3d.controls.addEventListener('end', that.controlEndHandler);

          that.sampleCounter = 0;

          that.pathTracingUniforms.gClippedAaBbMin.value = new THREE.Vector3(0, 0, 0);
          that.pathTracingUniforms.gClippedAaBbMax.value = new THREE.Vector3(PhysicalSize.x, PhysicalSize.y, PhysicalSize.z);
          that.pathTracingUniforms.gInvAaBbMax.value = new THREE.Vector3(1.0 / PhysicalSize.x, 1.0 / PhysicalSize.y, 1.0 / PhysicalSize.z);

          const GradientDelta = 1.0 / Math.max(sx, Math.max(sy, sz));
          const InvGradientDelta = 1.0 / GradientDelta;

          that.pathTracingUniforms.gGradientDeltaX.value = new THREE.Vector3(GradientDelta, 0, 0);
          that.pathTracingUniforms.gGradientDeltaY.value = new THREE.Vector3(0, GradientDelta, 0);
          that.pathTracingUniforms.gGradientDeltaZ.value = new THREE.Vector3(0, 0, GradientDelta);
          // can this be a per-x,y,z value?
          that.pathTracingUniforms.gInvGradientDelta.value = InvGradientDelta;
          that.pathTracingUniforms.gGradientFactor.value = 50.0;

          that.pathTracingUniforms.gStepSize.value = 1.0 * GradientDelta;
          that.pathTracingUniforms.gStepSizeShadow.value = 1.0 * GradientDelta;


          for (let i = 0; i < 2; ++i) {
            let lt = that.pathTracingUniforms.gLights.value[i];
            lt.m_InvWidth = 1.0 / lt.m_Width;
            lt.m_HalfWidth = 0.5 * lt.m_Width;
            lt.m_InvHalfWidth = 1.0 / lt.m_HalfWidth;
            lt.m_InvHeight = 1.0 / lt.m_Height;
            lt.m_HalfHeight = 0.5 * lt.m_Height;
            lt.m_InvHalfHeight = 1.0 / lt.m_HalfHeight;
            lt.m_Target.copy(bbctr);

            // Determine light position
            lt.m_P.x = lt.m_Distance * Math.cos(lt.m_Phi) * Math.sin(lt.m_Theta);
            lt.m_P.z = lt.m_Distance * Math.cos(lt.m_Phi) * Math.cos(lt.m_Theta);
            lt.m_P.y = lt.m_Distance * Math.sin(lt.m_Phi);

            lt.m_P.add(lt.m_Target);

            // Determine area
            if (lt.m_T === 0) {
              lt.m_Area = lt.m_Width * lt.m_Height;
              lt.m_AreaPdf = 1.0 / lt.m_Area;
            }

            if (lt.m_T === 1) {
              lt.m_P.copy(bbctr);
              // shift by nonzero amount
              lt.m_Target.addVectors(lt.m_P, new THREE.Vector3(0.0, 0.0, 1.0));
              lt.m_SkyRadius = 1000.0 * bbctr.length() * 2.0;
              lt.m_Area = 4.0 * Math.PI * Math.pow(lt.m_SkyRadius, 2.0);
              lt.m_AreaPdf = 1.0 / lt.m_Area;
            }

            // Compute orthogonal basis frame
            lt.m_N.subVectors(lt.m_Target, lt.m_P).normalize();
            lt.m_U.crossVectors(lt.m_N, new THREE.Vector3(0.0, 1.0, 0.0)).normalize();
            lt.m_V.crossVectors(lt.m_N, lt.m_U).normalize();
          }

          that.updateActiveChannels();

        }
    };



    this.canvas3d.animate_funcs.push(this.preRender.bind(this));
    this.canvas3d.animate_funcs.push(img.onAnimate.bind(img));
    this.canvas3d.animate_funcs.push(this.renderScene.bind(this));


  };

  updateActiveChannels() {
    var ch = [-1, -1, -1, -1];
    var activeChannel = 0;
    var NC = this.image.volume.num_channels;
    const maxch = 4;
    for (let i = 0; i < NC && activeChannel < maxch; ++i) {
      if ((this.image.fusion[i].rgbColor !== 0)) {
        ch[activeChannel] = i;
        activeChannel++;
      }
    }
    this.pathTracingUniforms.g_nChannels.value = activeChannel;

    this.viewChannels = ch;
    // update volume data according to channels selected.
    this.updateVolumeData4();
    this.sampleCounter = 0.0;
    this.updateLuts();
    this.updateMaterial();

    console.log(this.pathTracingUniforms);
  }

  updateVolumeData4() {
    var sx = this.image.volume.x, sy = this.image.volume.y, sz = this.image.volume.z;

    var data = new Uint8Array(sx*sy*sz * 4);
    data.fill(0);

    for (var i = 0; i < 4; ++i) {
      const ch = this.viewChannels[i];
      if (ch === -1) {
        continue;
      }

      for (var iz = 0; iz < sz; ++iz) {
        for (var iy = 0; iy < sy; ++iy) {
          for (var ix = 0; ix < sx; ++ix) {
            data[i + ix*4 + iy*4*sx + iz*4*sx*sy] = this.image.getChannel(ch).getIntensity(ix,iy,iz);
          }
        }
      }

      // set colors.
      this.pathTracingUniforms.g_Diffuse.value[i].fromArray(this.image.fusion[ch].rgbColor).multiplyScalar(1.0/255.0);
    }
    // defaults to rgba and unsignedbytetype so dont need to supply format this time.
    this.volumeTexture.image.data.set(data);
    this.volumeTexture.needsUpdate = true;
  }

  updateLuts() {
    for (let i = 0; i < this.pathTracingUniforms.g_nChannels.value; ++i) {
      this.pathTracingUniforms.g_lutTexture.value[i].image.data.set(this.image.volume.channels[this.viewChannels[i]].lut);
      this.pathTracingUniforms.g_lutTexture.value[i].needsUpdate = true;  

      this.pathTracingUniforms.g_intensityMax.value.setComponent(i, this.image.volume.channels[this.viewChannels[i]].histogram.dataMax / 255.0);

    }

    this.sampleCounter = 0.0;
  }

  updateMaterial() {
    for (let c = 0; c < this.viewChannels.length; ++c) {
       let i = this.viewChannels[c];
       if (i > -1) {
        this.pathTracingUniforms.g_Diffuse.value[c] = new THREE.Vector3().fromArray(this.image.fusion[i].rgbColor).multiplyScalar(1.0/255.0);
        this.pathTracingUniforms.g_Specular.value[c] = new THREE.Vector3().fromArray(this.image.specular[i]).multiplyScalar(1.0/255.0);
        this.pathTracingUniforms.g_Emissive.value[c] = new THREE.Vector3().fromArray(this.image.emissive[i]).multiplyScalar(1.0/255.0);
        this.pathTracingUniforms.g_Roughness.value[c] = this.image.roughness[i];
      }
    }
    this.sampleCounter = 0.0;
  }
  updateDensity(d) {
    this.pathTracingUniforms.gDensityScale.value = d;
    this.sampleCounter = 0.0;
  }

  updateShadingMethod(brdf) {
    this.pathTracingUniforms.gShadingType.value = brdf;
    this.sampleCounter = 0.0;
  }

  updateShowLights(showlights) {
    this.pathTracingUniforms.uShowLights.value = showlights;
    this.sampleCounter = 0.0;
  }

  updateExposure(e) {
    this.screenOutputMaterial.uniforms.gInvExposure.value = 1.0 / (1.0 - e);
    this.sampleCounter = 0.0;
  }
  
  updateCamera(fov, focalDistance, apertureSize) {
    this.pathTracingUniforms.gCamera.value.m_ApertureSize = apertureSize;
    this.pathTracingUniforms.gCamera.value.m_FocalDistance = focalDistance;
    const cam = this.canvas3d.perspectiveCamera;
    cam.fov = fov;

    this.sampleCounter = 0.0;
  }

  updateLights(state) {
    this.pathTracingUniforms.gLights.value[0].m_ColorTop = new THREE.Vector3(
      state.skyTopIntensity*state.skyTopColor[0]/255.0,
      state.skyTopIntensity*state.skyTopColor[1]/255.0,
      state.skyTopIntensity*state.skyTopColor[2]/255.0);
    this.pathTracingUniforms.gLights.value[0].m_ColorMiddle = new THREE.Vector3(
      state.skyMidIntensity*state.skyMidColor[0]/255.0,
      state.skyMidIntensity*state.skyMidColor[1]/255.0,
      state.skyMidIntensity*state.skyMidColor[2]/255.0);
    this.pathTracingUniforms.gLights.value[0].m_ColorBottom = new THREE.Vector3(
      state.skyBotIntensity*state.skyBotColor[0]/255.0,
      state.skyBotIntensity*state.skyBotColor[1]/255.0,
      state.skyBotIntensity*state.skyBotColor[2]/255.0);


    this.pathTracingUniforms.gLights.value[1].m_Color = new THREE.Vector3(
      state.lightIntensity*state.lightColor[0]/255.0,
      state.lightIntensity*state.lightColor[1]/255.0,
      state.lightIntensity*state.lightColor[2]/255.0);
    this.pathTracingUniforms.gLights.value[1].m_Theta = state.lightTheta * 3.14159265/180.0; 
    this.pathTracingUniforms.gLights.value[1].m_Phi = state.lightPhi * 3.14159265/180.0; 
    this.pathTracingUniforms.gLights.value[1].m_Theta = state.lightTheta; 
    this.pathTracingUniforms.gLights.value[1].m_Distance = state.lightDistance; 
    this.pathTracingUniforms.gLights.value[1].m_Width = state.lightSize; 
    this.pathTracingUniforms.gLights.value[1].m_Height = state.lightSize; 

    const PhysicalSize = this.image.volume.normalizedPhysicalSize;
    const bbctr = new THREE.Vector3(PhysicalSize.x*0.5, PhysicalSize.y*0.5, PhysicalSize.z*0.5);

    for (let i = 0; i < 2; ++i) {
      let lt = this.pathTracingUniforms.gLights.value[i];
      lt.m_InvWidth = 1.0 / lt.m_Width;
      lt.m_HalfWidth = 0.5 * lt.m_Width;
      lt.m_InvHalfWidth = 1.0 / lt.m_HalfWidth;
      lt.m_InvHeight = 1.0 / lt.m_Height;
      lt.m_HalfHeight = 0.5 * lt.m_Height;
      lt.m_InvHalfHeight = 1.0 / lt.m_HalfHeight;
      lt.m_Target.copy(bbctr);
    
      // Determine light position
      lt.m_P.x = lt.m_Distance * Math.cos(lt.m_Phi) * Math.sin(lt.m_Theta);
      lt.m_P.z = lt.m_Distance * Math.cos(lt.m_Phi) * Math.cos(lt.m_Theta);
      lt.m_P.y = lt.m_Distance * Math.sin(lt.m_Phi);
    
      lt.m_P.add(lt.m_Target);
    
      // Determine area
      if (lt.m_T === 0)
      {
        lt.m_Area = lt.m_Width * lt.m_Height;
        lt.m_AreaPdf = 1.0 / lt.m_Area;
      }
    
      if (lt.m_T === 1)
      {
        lt.m_P.copy(bbctr);
        // shift by nonzero amount
        lt.m_Target.addVectors(lt.m_P, new THREE.Vector3(0.0, 0.0, 1.0));
        lt.m_SkyRadius = 1000.0 * bbctr.length()*2.0;
        lt.m_Area = 4.0 * Math.PI * Math.pow(lt.m_SkyRadius, 2.0);
        lt.m_AreaPdf = 1.0 / lt.m_Area;
      }

      // Compute orthogonal basis frame
      lt.m_N.subVectors(lt.m_Target, lt.m_P).normalize();
      lt.m_U.crossVectors(lt.m_N, new THREE.Vector3(0.0, 1.0, 0.0)).normalize();
      lt.m_V.crossVectors(lt.m_N, lt.m_U).normalize();
    }
    this.sampleCounter = 0.0;

  }

  updateClipRegion(xmin, xmax, ymin, ymax, zmin, zmax) {
    const PhysicalSize = this.image.volume.normalizedPhysicalSize;
    this.pathTracingUniforms.gClippedAaBbMin.value = new THREE.Vector3(xmin*PhysicalSize.x, ymin*PhysicalSize.y, zmin*PhysicalSize.z);
    this.pathTracingUniforms.gClippedAaBbMax.value = new THREE.Vector3(xmax*PhysicalSize.x, ymax*PhysicalSize.y, zmax*PhysicalSize.z);
    this.sampleCounter = 0.0;
  }

  buildScene() {
    this.scene = new THREE.Scene();
    this.canvas3d.scene = this.scene;

    this.pathTracingScene = new THREE.Scene();
    this.screenTextureScene = new THREE.Scene();

    // quadCamera is simply the camera to help render the full screen quad (2 triangles),
    // hence the name.  It is an Orthographic camera that sits facing the view plane, which serves as
    // the window into our 3d world. This camera will not move or rotate for the duration of the app.
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.screenTextureScene.add(this.quadCamera);
    this.scene.add(this.quadCamera);

    // worldCamera is the dynamic camera 3d object that will be positioned, oriented and 
    // constantly updated inside the 3d scene.  Its view will ultimately get passed back to the 
    // stationary quadCamera, which renders the scene to a fullscreen quad (made up of 2 large triangles).
    this.pathTracingScene.add(this.canvas3d.perspectiveCamera);

    const pixelRatio = 1.0;

    this.pathTracingRenderTarget = new THREE.WebGLRenderTarget((this.canvas3d.w * pixelRatio), (this.canvas3d.h * pixelRatio), {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false
    });
    this.pathTracingRenderTarget.texture.generateMipmaps = false;

    this.screenTextureRenderTarget = new THREE.WebGLRenderTarget((this.canvas3d.w * pixelRatio), (this.canvas3d.h * pixelRatio), {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false
    });
    this.screenTextureRenderTarget.texture.generateMipmaps = false;

    this.screenTextureShader = {

      uniforms: THREE.UniformsUtils.merge([

        {
          tTexture0: {
            type: "t",
            value: null
          }
        }

      ]),

      vertexShader: [
        '#version 300 es',

        'precision highp float;',
        'precision highp int;',

        'out vec2 vUv;',

        'void main()',
        '{',
        'vUv = uv;',
        'gl_Position = vec4( position, 1.0 );',
        '}'

      ].join('\n'),

      fragmentShader: [
        '#version 300 es',

        'precision highp float;',
        'precision highp int;',
        'precision highp sampler2D;',

        'uniform sampler2D tTexture0;',
        'in vec2 vUv;',
        'out vec4 out_FragColor;',

        'void main()',
        '{',
        'out_FragColor = texture(tTexture0, vUv);',
        '}'

      ].join('\n')

    };

    this.screenOutputShader = {

      uniforms: THREE.UniformsUtils.merge([

        {
          uOneOverSampleCounter: {
            type: "f",
            value: 0.0
          },
          gInvExposure: {
            type: "f",
            value: 1.0 / (1.0 - 0.75)
          },
          tTexture0: {
            type: "t",
            value: null
          }
        }

      ]),

      vertexShader: [
        '#version 300 es',

        'precision highp float;',
        'precision highp int;',

        'out vec2 vUv;',

        'void main()',
        '{',
        'vUv = uv;',
        'gl_Position = vec4( position, 1.0 );',
        '}'

      ].join('\n'),

      fragmentShader: [
        '#version 300 es',

        'precision highp float;',
        'precision highp int;',
        'precision highp sampler2D;',

        'uniform float uOneOverSampleCounter;',
        'uniform float gInvExposure;',
        'uniform sampler2D tTexture0;',
        'in vec2 vUv;',
        'out vec4 out_FragColor;',

        'vec3 XYZtoRGB(vec3 xyz) {',
          'return vec3(',
            '3.240479f*xyz[0] - 1.537150f*xyz[1] - 0.498535f*xyz[2],',
            '-0.969256f*xyz[0] + 1.875991f*xyz[1] + 0.041556f*xyz[2],',
            '0.055648f*xyz[0] - 0.204043f*xyz[1] + 1.057311f*xyz[2]',
          ');',
        '}',

        'void main()',
        '{',
          'vec4 pixelColor = texture(tTexture0, vUv);', // * uOneOverSampleCounter;',
          // TODO TONE MAP!!!!!!
          'pixelColor.rgb = XYZtoRGB(pixelColor.rgb);',

          //'pixelColor.rgb = pow(pixelColor.rgb, vec3(1.0/2.2));',
          'pixelColor.rgb = 1.0-exp(-pixelColor.rgb*gInvExposure);',
          'pixelColor = clamp(pixelColor, 0.0, 1.0);',

          'out_FragColor = pixelColor;', // sqrt(pixelColor);',
          //'out_FragColor = pow(pixelColor, vec4(1.0/2.2));',
        '}'

      ].join('\n')

    };

    this.pathTracingGeometry = new THREE.PlaneBufferGeometry(2, 2);

    this.pathTracingUniforms = pathTracingUniforms;
    // initialize texture.
    this.pathTracingUniforms.tPreviousTexture.value = this.screenTextureRenderTarget.texture;

    this.pathTracingMaterial = new THREE.ShaderMaterial({
      uniforms: this.pathTracingUniforms,
      //defines: pathTracingDefines,
      vertexShader: pathTracingVertexShaderSrc,
      fragmentShader: pathTracingFragmentShaderSrc,
      depthTest: false,
      depthWrite: false
    });
    this.pathTracingMesh = new THREE.Mesh(this.pathTracingGeometry, this.pathTracingMaterial);
    this.pathTracingScene.add(this.pathTracingMesh);

    // the following keeps the large scene ShaderMaterial quad right in front 
    //   of the camera at all times. This is necessary because without it, the scene 
    //   quad will fall out of view and get clipped when the camera rotates past 180 degrees.
    this.canvas3d.perspectiveCamera.add(this.pathTracingMesh);

    this.screenTextureGeometry = new THREE.PlaneBufferGeometry(2, 2);

    this.screenTextureMaterial = new THREE.ShaderMaterial({
      uniforms: this.screenTextureShader.uniforms,
      vertexShader: this.screenTextureShader.vertexShader,
      fragmentShader: this.screenTextureShader.fragmentShader,
      depthWrite: false,
      depthTest: false
    });

    this.screenTextureMaterial.uniforms.tTexture0.value = this.pathTracingRenderTarget.texture;

    this.screenTextureMesh = new THREE.Mesh(this.screenTextureGeometry, this.screenTextureMaterial);
    this.screenTextureScene.add(this.screenTextureMesh);



    this.screenOutputGeometry = new THREE.PlaneBufferGeometry(2, 2);

    this.screenOutputMaterial = new THREE.ShaderMaterial({
      uniforms: this.screenOutputShader.uniforms,
      vertexShader: this.screenOutputShader.vertexShader,
      fragmentShader: this.screenOutputShader.fragmentShader,
      depthWrite: false,
      depthTest: false
    });

    this.screenOutputMaterial.uniforms.tTexture0.value = this.pathTracingRenderTarget.texture;

    this.screenOutputMesh = new THREE.Mesh(this.screenOutputGeometry, this.screenOutputMaterial);
    this.scene.add(this.screenOutputMesh);


    //////////////////////////////////////////////////////
    //////////////////////////////////////////////////////

    this.oldScale = new THREE.Vector3(0.5, 0.5, 0.5);
    this.currentScale = new THREE.Vector3(0.5, 0.5, 0.5);

    // background color
    this.canvas3d.renderer.setClearColor(this.backgroundColor, 1.000);

    this.lightContainer = new THREE.Object3D();
    this.lightContainer.name = 'lightContainer';

    this.ambientLight = new THREE.AmbientLight(lightSettings.ambientLightSettings.color, lightSettings.ambientLightSettings.intensity);
    this.lightContainer.add(this.ambientLight);

    // key light
    this.spotLight = new THREE.SpotLight(lightSettings.spotlightSettings.color, lightSettings.spotlightSettings.intensity);
    this.spotLight.position.set(
      lightSettings.spotlightSettings.position.x,
      lightSettings.spotlightSettings.position.y,
      lightSettings.spotlightSettings.position.z
    );
    this.spotLight.target = new THREE.Object3D(); // this.substrate;
    this.spotLight.angle = lightSettings.spotlightSettings.angle;


    this.lightContainer.add(this.spotLight);

    // reflect light
    this.reflectedLight = new THREE.DirectionalLight(lightSettings.reflectedLightSettings.color);
    this.reflectedLight.position.set(
      lightSettings.reflectedLightSettings.position.x,
      lightSettings.reflectedLightSettings.position.y,
      lightSettings.reflectedLightSettings.position.z
    );
    this.reflectedLight.castShadow = lightSettings.reflectedLightSettings.castShadow;
    this.reflectedLight.intensity = lightSettings.reflectedLightSettings.intensity;
    this.lightContainer.add(this.reflectedLight);

    // fill light
    this.fillLight = new THREE.DirectionalLight(lightSettings.fillLightSettings.color);
    this.fillLight.position.set(
      lightSettings.fillLightSettings.position.x,
      lightSettings.fillLightSettings.position.y,
      lightSettings.fillLightSettings.position.z
    );
    this.fillLight.castShadow = lightSettings.fillLightSettings.castShadow;
    this.fillLight.intensity = lightSettings.fillLightSettings.intensity;
    this.lightContainer.add(this.fillLight);

    //this.scene.add(this.lightContainer);
  };

  /**
   * Change the camera projection to look along an axis, or to view in a 3d perspective camera.
   * @param {string} mode Mode can be "3D", or "XY" or "Z", or "YZ" or "X, or "XZ" or "Y".  3D is a perspective view, and all the others are orthographic projections
   */
  setCameraMode(mode) {
    this.canvas3d.switchViewMode(mode);
    if (this.image && mode === '3D') {
      // reset ortho thickness when mode changes to 3D.
      this.image.setOrthoThickness(1.0);
    }
  };

  /**
   * Enable or disable 3d axis display at lower left.
   * @param {boolean} showAxis 
   */
  setShowAxis(showAxis) {
    this.canvas3d.showAxis = showAxis;
  };

  /**
   * Enable or disable a turntable rotation mode. The display will continuously spin about the vertical screen axis.
   * @param {boolean} autorotate 
   */
  setAutoRotate(autorotate) {
    this.canvas3d.setAutoRotate(autorotate);
    this.sampleCounter = 0;
    this.cameraIsMoving = autorotate;
  };

  /**
   * Notify the view that it has been resized.  This will automatically be connected to the window when the AICSview3d is created.
   * @param {HTMLElement=} comp Ignored.
   * @param {number=} w Width, or parent element's offsetWidth if not specified. 
   * @param {number=} h Height, or parent element's offsetHeight if not specified.
   * @param {number=} ow Ignored.
   * @param {number=} oh Ignored.
   * @param {Object=} eOpts Ignored.
   */
  resize(comp, w, h, ow, oh, eOpts) {
    w = w || this.parentEl.offsetWidth;
    h = h || this.parentEl.offsetHeight;
    this.canvas3d.resize(comp, w, h, ow, oh, eOpts);

    this.pathTracingUniforms.uResolution.value.x = w;
    this.pathTracingUniforms.uResolution.value.y = h;
    
    this.pathTracingRenderTarget.setSize( w, h );
    this.screenTextureRenderTarget.setSize( w, h );
    
    // the following scales all scene objects by the worldCamera's field of view,
    // taking into account the screen aspect ratio and multiplying the uniform uULen,
    // the x-coordinate, by this ratio
    //const fovScale = this.canvas3d.perspectiveCamera.fov * 0.5 * (Math.PI / 180.0);
    //this.pathTracingUniforms.uVLen.value = Math.tan(fovScale);
    //this.pathTracingUniforms.uULen.value = this.pathTracingUniforms.uVLen.value * this.canvas3d.perspectiveCamera.aspect;


    if (this.image) {
      this.image.setResolution(this.canvas3d);
    }
  };

}
