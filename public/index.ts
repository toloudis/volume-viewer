import { Vector3 } from "three";
import * as dat from "dat.gui";

import {
  View3d,
  Volume,
  VolumeMaker,
  VolumeLoader,
  Light,
  AREA_LIGHT,
  RENDERMODE_PATHTRACE,
  RENDERMODE_RAYMARCH,
  SKY_LIGHT,
} from "../src";
import { State } from "./types";
import { getDefaultImageInfo } from "../src/Volume";

let view3D: View3d;

const myState: State = {
  file: "",
  volume: new Volume(),
  timeSeriesVolumes: [],
  numberOfVolumesCached: 0,
  totalFrames: 0,
  currentFrame: 0,
  timerId: 0,

  density: 12.5,
  maskAlpha: 1.0,
  exposure: 0.75,
  aperture: 0.0,
  fov: 20,
  focalDistance: 4.0,

  lights: [new Light(SKY_LIGHT), new Light(AREA_LIGHT)],

  skyTopIntensity: 0.3,
  skyMidIntensity: 0.3,
  skyBotIntensity: 0.3,
  skyTopColor: [255, 255, 255],
  skyMidColor: [255, 255, 255],
  skyBotColor: [255, 255, 255],

  lightColor: [255, 255, 255],
  lightIntensity: 75.0,
  lightTheta: 14, //deg
  lightPhi: 54, //deg

  xmin: 0.0,
  ymin: 0.0,
  zmin: 0.0,
  xmax: 1.0,
  ymax: 1.0,
  zmax: 1.0,

  samplingRate: 0.25,
  primaryRay: 1.0,
  secondaryRay: 1.0,

  isPT: false,

  isTurntable: false,
  isAxisShowing: false,
  isAligned: true,

  showBoundingBox: false,
  boundingBoxColor: [255, 255, 0],
  flipX: 1,
  flipY: 1,
  flipZ: 1,

  channelFolderNames: [],
  infoObj: getDefaultImageInfo(),
  channelGui: [],
};

// controlPoints is array of [{offset:number, color:cssstring}]
// where offset is a value from 0.0 to 1.0, and color is a string encoding a css color value.
// first and last control points should be at offsets 0 and 1
// TODO: what if offsets 0 and 1 are not provided?
// makeColorGradient([
//    {offset:0, color:"black"},
//    {offset:0.2, color:"black"},
//    {offset:0.25, color:"red"},
//    {offset:0.5, color:"orange"}
//    {offset:1.0, color:"yellow"}
//]);
/*
function makeColorGradient(controlPoints) {
  const c = document.createElement("canvas");
  c.style.height = 1;
  c.style.width = 256;
  c.height = 1;
  c.width = 256;

  const ctx = c.getContext("2d");
  const grd = ctx.createLinearGradient(0, 0, 255, 0);
  if (!controlPoints.length || controlPoints.length < 1) {
    console.log("warning: bad control points submitted to makeColorGradient; reverting to linear greyscale gradient");
    grd.addColorStop(0, "black");
    grd.addColorStop(1, "white");
  } else {
    // what if none at 0 and none at 1?
    for (let i = 0; i < controlPoints.length; ++i) {
      grd.addColorStop(controlPoints[i].offset, controlPoints[i].color);
    }
  }

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 1);
  const imgData = ctx.getImageData(0, 0, 256, 1);
  // console.log(imgData.data);
  return imgData.data;
}
*/
function initLights() {
  myState.lights[0].mColorTop = new Vector3(
    (myState.skyTopColor[0] / 255.0) * myState.skyTopIntensity,
    (myState.skyTopColor[1] / 255.0) * myState.skyTopIntensity,
    (myState.skyTopColor[2] / 255.0) * myState.skyTopIntensity
  );
  myState.lights[0].mColorMiddle = new Vector3(
    (myState.skyMidColor[0] / 255.0) * myState.skyMidIntensity,
    (myState.skyMidColor[1] / 255.0) * myState.skyMidIntensity,
    (myState.skyMidColor[2] / 255.0) * myState.skyMidIntensity
  );
  myState.lights[0].mColorBottom = new Vector3(
    (myState.skyBotColor[0] / 255.0) * myState.skyBotIntensity,
    (myState.skyBotColor[1] / 255.0) * myState.skyBotIntensity,
    (myState.skyBotColor[2] / 255.0) * myState.skyBotIntensity
  );
  myState.lights[1].mTheta = (myState.lightTheta * Math.PI) / 180.0;
  myState.lights[1].mPhi = (myState.lightPhi * Math.PI) / 180.0;
  myState.lights[1].mColor = new Vector3(
    (myState.lightColor[0] / 255.0) * myState.lightIntensity,
    (myState.lightColor[1] / 255.0) * myState.lightIntensity,
    (myState.lightColor[2] / 255.0) * myState.lightIntensity
  );
  view3D.updateLights(myState.lights);
}

let gui: dat.GUI;

function setupGui() {
  gui = new dat.GUI();
  //gui = new dat.GUI({autoPlace:false, width:200});

  gui
    .add(myState, "density")
    .max(100.0)
    .min(0.0)
    .step(0.001)
    .onChange(function (value) {
      view3D.updateDensity(myState.volume, value / 50.0);
    });
  gui
    .add(myState, "maskAlpha")
    .max(1.0)
    .min(0.0)
    .step(0.001)
    .onChange(function (value) {
      view3D.updateMaskAlpha(myState.volume, value);
    });
  gui
    .add(myState, "primaryRay")
    .max(40.0)
    .min(1.0)
    .step(0.1)
    .onChange(function () {
      view3D.setRayStepSizes(myState.volume, myState.primaryRay, myState.secondaryRay);
    });
  gui
    .add(myState, "secondaryRay")
    .max(40.0)
    .min(1.0)
    .step(0.1)
    .onChange(function () {
      view3D.setRayStepSizes(myState.volume, myState.primaryRay, myState.secondaryRay);
    });

  const cameraGui = gui.addFolder("Camera");
  cameraGui
    .add(myState, "exposure")
    .max(1.0)
    .min(0.0)
    .step(0.001)
    .onChange(function (value) {
      view3D.updateExposure(value);
    });
  cameraGui
    .add(myState, "aperture")
    .max(0.1)
    .min(0.0)
    .step(0.001)
    .onChange(function () {
      view3D.updateCamera(myState.fov, myState.focalDistance, myState.aperture);
    });
  cameraGui
    .add(myState, "focalDistance")
    .max(5.0)
    .min(0.1)
    .step(0.001)
    .onChange(function () {
      view3D.updateCamera(myState.fov, myState.focalDistance, myState.aperture);
    });
  cameraGui
    .add(myState, "fov")
    .max(90.0)
    .min(0.0)
    .step(0.001)
    .onChange(function () {
      view3D.updateCamera(myState.fov, myState.focalDistance, myState.aperture);
    });
  cameraGui
    .add(myState, "samplingRate")
    .max(1.0)
    .min(0.1)
    .step(0.001)
    .onChange(function (value) {
      view3D.updatePixelSamplingRate(value);
    });

  const clipping = gui.addFolder("Clipping Box");
  clipping
    .add(myState, "xmin")
    .max(1.0)
    .min(0.0)
    .step(0.001)
    .onChange(function () {
      view3D.updateClipRegion(
        myState.volume,
        myState.xmin,
        myState.xmax,
        myState.ymin,
        myState.ymax,
        myState.zmin,
        myState.zmax
      );
    });
  clipping
    .add(myState, "xmax")
    .max(1.0)
    .min(0.0)
    .step(0.001)
    .onChange(function () {
      view3D.updateClipRegion(
        myState.volume,
        myState.xmin,
        myState.xmax,
        myState.ymin,
        myState.ymax,
        myState.zmin,
        myState.zmax
      );
    });
  clipping
    .add(myState, "ymin")
    .max(1.0)
    .min(0.0)
    .step(0.001)
    .onChange(function () {
      view3D.updateClipRegion(
        myState.volume,
        myState.xmin,
        myState.xmax,
        myState.ymin,
        myState.ymax,
        myState.zmin,
        myState.zmax
      );
    });
  clipping
    .add(myState, "ymax")
    .max(1.0)
    .min(0.0)
    .step(0.001)
    .onChange(function () {
      view3D.updateClipRegion(
        myState.volume,
        myState.xmin,
        myState.xmax,
        myState.ymin,
        myState.ymax,
        myState.zmin,
        myState.zmax
      );
    });
  clipping
    .add(myState, "zmin")
    .max(1.0)
    .min(0.0)
    .step(0.001)
    .onChange(function () {
      view3D.updateClipRegion(
        myState.volume,
        myState.xmin,
        myState.xmax,
        myState.ymin,
        myState.ymax,
        myState.zmin,
        myState.zmax
      );
    });
  clipping
    .add(myState, "zmax")
    .max(1.0)
    .min(0.0)
    .step(0.001)
    .onChange(function () {
      view3D.updateClipRegion(
        myState.volume,
        myState.xmin,
        myState.xmax,
        myState.ymin,
        myState.ymax,
        myState.zmin,
        myState.zmax
      );
    });

  const lighting = gui.addFolder("Lighting");
  lighting
    .addColor(myState, "skyTopColor")
    .name("Sky Top")
    .onChange(function () {
      myState.lights[0].mColorTop = new Vector3(
        (myState.skyTopColor[0] / 255.0) * myState.skyTopIntensity,
        (myState.skyTopColor[1] / 255.0) * myState.skyTopIntensity,
        (myState.skyTopColor[2] / 255.0) * myState.skyTopIntensity
      );
      view3D.updateLights(myState.lights);
    });
  lighting
    .add(myState, "skyTopIntensity")
    .max(100.0)
    .min(0.01)
    .step(0.1)
    .onChange(function () {
      myState.lights[0].mColorTop = new Vector3(
        (myState.skyTopColor[0] / 255.0) * myState.skyTopIntensity,
        (myState.skyTopColor[1] / 255.0) * myState.skyTopIntensity,
        (myState.skyTopColor[2] / 255.0) * myState.skyTopIntensity
      );
      view3D.updateLights(myState.lights);
    });
  lighting
    .addColor(myState, "skyMidColor")
    .name("Sky Mid")
    .onChange(function () {
      myState.lights[0].mColorMiddle = new Vector3(
        (myState.skyMidColor[0] / 255.0) * myState.skyMidIntensity,
        (myState.skyMidColor[1] / 255.0) * myState.skyMidIntensity,
        (myState.skyMidColor[2] / 255.0) * myState.skyMidIntensity
      );
      view3D.updateLights(myState.lights);
    });
  lighting
    .add(myState, "skyMidIntensity")
    .max(100.0)
    .min(0.01)
    .step(0.1)
    .onChange(function () {
      myState.lights[0].mColorMiddle = new Vector3(
        (myState.skyMidColor[0] / 255.0) * myState.skyMidIntensity,
        (myState.skyMidColor[1] / 255.0) * myState.skyMidIntensity,
        (myState.skyMidColor[2] / 255.0) * myState.skyMidIntensity
      );
      view3D.updateLights(myState.lights);
    });
  lighting
    .addColor(myState, "skyBotColor")
    .name("Sky Bottom")
    .onChange(function () {
      myState.lights[0].mColorBottom = new Vector3(
        (myState.skyBotColor[0] / 255.0) * myState.skyBotIntensity,
        (myState.skyBotColor[1] / 255.0) * myState.skyBotIntensity,
        (myState.skyBotColor[2] / 255.0) * myState.skyBotIntensity
      );
      view3D.updateLights(myState.lights);
    });
  lighting
    .add(myState, "skyBotIntensity")
    .max(100.0)
    .min(0.01)
    .step(0.1)
    .onChange(function () {
      myState.lights[0].mColorBottom = new Vector3(
        (myState.skyBotColor[0] / 255.0) * myState.skyBotIntensity,
        (myState.skyBotColor[1] / 255.0) * myState.skyBotIntensity,
        (myState.skyBotColor[2] / 255.0) * myState.skyBotIntensity
      );
      view3D.updateLights(myState.lights);
    });
  lighting
    .add(myState.lights[1], "mDistance")
    .max(10.0)
    .min(0.0)
    .step(0.1)
    .onChange(function () {
      view3D.updateLights(myState.lights);
    });
  lighting
    .add(myState, "lightTheta")
    .max(180.0)
    .min(-180.0)
    .step(1)
    .onChange(function (value) {
      myState.lights[1].mTheta = (value * Math.PI) / 180.0;
      view3D.updateLights(myState.lights);
    });
  lighting
    .add(myState, "lightPhi")
    .max(180.0)
    .min(0.0)
    .step(1)
    .onChange(function (value) {
      myState.lights[1].mPhi = (value * Math.PI) / 180.0;
      view3D.updateLights(myState.lights);
    });
  lighting
    .add(myState.lights[1], "mWidth")
    .max(100.0)
    .min(0.01)
    .step(0.1)
    .onChange(function (value) {
      myState.lights[1].mWidth = value;
      myState.lights[1].mHeight = value;
      view3D.updateLights(myState.lights);
    });
  lighting
    .add(myState, "lightIntensity")
    .max(1000.0)
    .min(0.01)
    .step(0.1)
    .onChange(function () {
      myState.lights[1].mColor = new Vector3(
        (myState.lightColor[0] / 255.0) * myState.lightIntensity,
        (myState.lightColor[1] / 255.0) * myState.lightIntensity,
        (myState.lightColor[2] / 255.0) * myState.lightIntensity
      );
      view3D.updateLights(myState.lights);
    });
  lighting
    .addColor(myState, "lightColor")
    .name("lightColor")
    .onChange(function () {
      myState.lights[1].mColor = new Vector3(
        (myState.lightColor[0] / 255.0) * myState.lightIntensity,
        (myState.lightColor[1] / 255.0) * myState.lightIntensity,
        (myState.lightColor[2] / 255.0) * myState.lightIntensity
      );
      view3D.updateLights(myState.lights);
    });

  initLights();
}

function removeFolderByName(name: string) {
  const folder = gui.__folders[name];
  if (!folder) {
    return;
  }
  folder.close();
  // @ts-expect-error __ul doesn't exist in the type declaration
  gui.__ul.removeChild(folder.domElement.parentNode);
  delete gui.__folders[name];
  // @ts-expect-error onResize doesn't exist in the type declaration
  gui.onResize();
}

function showChannelUI(volume: Volume) {
  if (myState && myState.channelFolderNames) {
    for (let i = 0; i < myState.channelFolderNames.length; ++i) {
      removeFolderByName(myState.channelFolderNames[i]);
    }
  }

  myState.infoObj = volume.imageInfo;

  myState.channelGui = [];

  myState.channelFolderNames = [];
  for (let i = 0; i < myState.infoObj.channels; ++i) {
    myState.channelGui.push({
      colorD: volume.channel_colors_default[i],
      colorS: [0, 0, 0],
      colorE: [0, 0, 0],
      window: 1.0,
      level: 0.5,
      glossiness: 0.0,
      isovalue: 128, // actual intensity value
      isosurface: false,
      // first 3 channels for starters
      enabled: i < 3,
      // this doesn't give good results currently but is an example of a per-channel button callback
      autoIJ: (function (j) {
        return function () {
          const lut = volume.getHistogram(j).lutGenerator_auto2();
          // TODO: get a proper transfer function editor
          // const lut = { lut: makeColorGradient([
          //     {offset:0, color:"black"},
          //     {offset:0.2, color:"black"},
          //     {offset:0.25, color:"red"},
          //     {offset:0.5, color:"orange"},
          //     {offset:1.0, color:"yellow"}])
          // };
          volume.setLut(j, lut.lut);
          view3D.updateLuts(volume);
        };
      })(i),
      // this doesn't give good results currently but is an example of a per-channel button callback
      auto0: (function (j) {
        return function () {
          const lut = volume.getHistogram(j).lutGenerator_auto();
          volume.setLut(j, lut.lut);
          view3D.updateLuts(volume);
        };
      })(i),
      // this doesn't give good results currently but is an example of a per-channel button callback
      bestFit: (function (j) {
        return function () {
          const lut = volume.getHistogram(j).lutGenerator_bestFit();
          volume.setLut(j, lut.lut);
          view3D.updateLuts(volume);
        };
      })(i),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      pct50_98: (function (j) {
        return function () {
          const lut = volume.getHistogram(j).lutGenerator_percentiles(0.5, 0.998);
          volume.setLut(j, lut.lut);
          view3D.updateLuts(volume);
        };
      })(i),
      colorizeEnabled: false,
      colorize: (function (j) {
        return function () {
          const lut = volume.getHistogram(j).lutGenerator_labelColors();
          volume.setColorPalette(j, lut.lut);
          myState.channelGui[j].colorizeEnabled = !myState.channelGui[j].colorizeEnabled;
          if (myState.channelGui[j].colorizeEnabled) {
            volume.setColorPaletteAlpha(j, myState.channelGui[j].colorizeAlpha);
          } else {
            volume.setColorPaletteAlpha(j, 0);
          }

          view3D.updateLuts(volume);
        };
      })(i),
      colorizeAlpha: 0.0,
    });
    const f = gui.addFolder("Channel " + myState.infoObj.channel_names[i]);
    myState.channelFolderNames.push("Channel " + myState.infoObj.channel_names[i]);
    f.add(myState.channelGui[i], "enabled").onChange(
      (function (j) {
        return function (value) {
          view3D.setVolumeChannelEnabled(volume, j, value ? true : false);
          view3D.updateActiveChannels(volume);
        };
      })(i)
    );
    f.add(myState.channelGui[i], "isosurface").onChange(
      (function (j) {
        return function (value) {
          if (value) {
            view3D.createIsosurface(volume, j, myState.channelGui[j].isovalue, 1.0);
          } else {
            view3D.clearIsosurface(volume, j);
          }
        };
      })(i)
    );
    f.add(myState.channelGui[i], "isovalue")
      .max(255)
      .min(0)
      .step(1)
      .onChange(
        (function (j) {
          return function (value) {
            view3D.updateIsosurface(volume, j, value);
          };
        })(i)
      );

    f.addColor(myState.channelGui[i], "colorD")
      .name("Diffuse")
      .onChange(
        (function (j) {
          return function () {
            view3D.updateChannelMaterial(
              volume,
              j,
              myState.channelGui[j].colorD,
              myState.channelGui[j].colorS,
              myState.channelGui[j].colorE,
              myState.channelGui[j].glossiness
            );
            view3D.updateMaterial(volume);
          };
        })(i)
      );
    f.addColor(myState.channelGui[i], "colorS")
      .name("Specular")
      .onChange(
        (function (j) {
          return function () {
            view3D.updateChannelMaterial(
              volume,
              j,
              myState.channelGui[j].colorD,
              myState.channelGui[j].colorS,
              myState.channelGui[j].colorE,
              myState.channelGui[j].glossiness
            );
            view3D.updateMaterial(volume);
          };
        })(i)
      );
    f.addColor(myState.channelGui[i], "colorE")
      .name("Emissive")
      .onChange(
        (function (j) {
          return function () {
            view3D.updateChannelMaterial(
              volume,
              j,
              myState.channelGui[j].colorD,
              myState.channelGui[j].colorS,
              myState.channelGui[j].colorE,
              myState.channelGui[j].glossiness
            );
            view3D.updateMaterial(volume);
          };
        })(i)
      );
    f.add(myState.channelGui[i], "window")
      .max(1.0)
      .min(0.0)
      .step(0.001)
      .onChange(
        (function (j) {
          return function (value) {
            volume.getChannel(j).lutGenerator_windowLevel(value, myState.channelGui[j].level);
            view3D.updateLuts(volume);
          };
        })(i)
      );

    f.add(myState.channelGui[i], "level")
      .max(1.0)
      .min(0.0)
      .step(0.001)
      .onChange(
        (function (j) {
          return function (value) {
            volume.getChannel(j).lutGenerator_windowLevel(myState.channelGui[j].window, value);
            view3D.updateLuts(volume);
          };
        })(i)
      );
    f.add(myState.channelGui[i], "autoIJ");
    f.add(myState.channelGui[i], "auto0");
    f.add(myState.channelGui[i], "bestFit");
    f.add(myState.channelGui[i], "pct50_98");
    f.add(myState.channelGui[i], "colorize");
    f.add(myState.channelGui[i], "colorizeAlpha")
      .max(1.0)
      .min(0.0)
      .onChange(
        (function (j) {
          return function (value) {
            if (myState.channelGui[j].colorizeEnabled) {
              volume.setColorPaletteAlpha(j, value);
              view3D.updateLuts(volume);
            }
          };
        })(i)
      );
    f.add(myState.channelGui[i], "glossiness")
      .max(100.0)
      .min(0.0)
      .onChange(
        (function (j) {
          return function () {
            view3D.updateChannelMaterial(
              volume,
              j,
              myState.channelGui[j].colorD,
              myState.channelGui[j].colorS,
              myState.channelGui[j].colorE,
              myState.channelGui[j].glossiness
            );
            view3D.updateMaterial(volume);
          };
        })(i)
      );
  }
}

function loadVolumeAtlasData(vol, jsonData) {
  view3D.removeAllVolumes();
  view3D.addVolume(vol);

  view3D.setVolumeRenderMode(myState.isPT ? RENDERMODE_PATHTRACE : RENDERMODE_RAYMARCH);
  // first 3 channels for starters
  for (let ch = 0; ch < vol.num_channels; ++ch) {
    view3D.setVolumeChannelEnabled(myState.volume, ch, ch < 3);
  }
  view3D.setVolumeChannelAsMask(vol, jsonData.channel_names.indexOf("SEG_Memb"));
  view3D.updateActiveChannels(vol);
  view3D.updateLuts(vol);
  view3D.updateLights(myState.lights);
  view3D.updateDensity(vol, myState.density / 100.0);
  view3D.updateExposure(myState.exposure);
  // apply a volume transform from an external source:
  if (jsonData.userData && jsonData.userData.alignTransform) {
    view3D.setVolumeTranslation(vol, vol.voxelsToWorldSpace(jsonData.userData.alignTransform.translation));
    view3D.setVolumeRotation(vol, jsonData.userData.alignTransform.rotation);
  }

  myState.currentFrame = 0;
  showChannelUI(vol);

  VolumeLoader.loadVolumeAtlasData(vol, jsonData.images, (url, channelIndex) => {
    vol.channels[channelIndex].lutGenerator_percentiles(0.5, 0.998);

    if (vol.loaded) {
      // has assumption that only 3 channels
      view3D.onVolumeData(vol, [0, 1, 2]);
      view3D.updateActiveChannels(vol);
      view3D.updateLuts(vol);
    }
  });
}

function loadImageData(jsonData, volumeData?) {
  const vol = new Volume(jsonData);
  myState.volume = vol;

  // tell the viewer about the image AFTER it's loaded
  //view3D.removeAllVolumes();
  //view3D.addVolume(vol);

  // get data into the image
  if (volumeData) {
    for (let i = 0; i < volumeData.length; ++i) {
      // where each volumeData element is a flat Uint8Array of xyz data
      // according to jsonData.tile_width*jsonData.tile_height*jsonData.tiles
      // (first row of first plane is the first data in
      // the layout, then second row of first plane, etc)
      vol.setChannelDataFromVolume(i, volumeData[i]);

      view3D.setVolumeRenderMode(myState.isPT ? RENDERMODE_PATHTRACE : RENDERMODE_RAYMARCH);

      view3D.removeAllVolumes();
      view3D.addVolume(vol);

      // first 3 channels for starters
      for (let ch = 0; ch < vol.num_channels; ++ch) {
        view3D.setVolumeChannelEnabled(vol, ch, ch < 3);
      }

      const maskChannelIndex = jsonData.channel_names.indexOf("SEG_Memb");
      view3D.setVolumeChannelAsMask(vol, maskChannelIndex);
      view3D.updateActiveChannels(vol);
      view3D.updateLuts(vol);
      view3D.updateLights(myState.lights);
      view3D.updateDensity(vol, myState.density / 100.0);
      view3D.updateExposure(myState.exposure);
    }
  } else {
    loadVolumeAtlasData(vol, jsonData);
  }
  showChannelUI(vol);

  return vol;
}

function cacheTimeSeriesImageData(jsonData, frameNumber) {
  const vol = new Volume(jsonData);
  myState.timeSeriesVolumes[frameNumber] = vol;
  return vol;
}

function fetchImage(url, isTimeSeries = false, frameNumber = 0) {
  fetch(url)
    .then(function (response) {
      return response.json();
    })
    .then(function (myJson) {
      if (isTimeSeries) {
        // if you need to adjust image paths prior to download,
        // now is the time to do it:
        myJson.images.forEach(function (element) {
          element.name = "http://dev-aics-dtp-001.corp.alleninstitute.org/dan-data/" + element.name;
        });

        const currentVol = cacheTimeSeriesImageData(myJson, frameNumber);
        if (frameNumber === 0) {
          // create the main volume and add to view (this is the only place)
          myState.volume = new Volume(myJson);

          // TODO: this can go in the Volume and Channel constructors!
          // preallocate some memory to be filled in later
          for (let i = 0; i < myState.volume.num_channels; ++i) {
            myState.volume.channels[i].imgData = {
              data: new Uint8ClampedArray(myJson.atlas_width * myJson.atlas_height),
              width: myJson.atlas_width,
              height: myJson.atlas_height,
            };
            myState.volume.channels[i].volumeData = new Uint8Array(
              myJson.tile_width * myJson.tile_height * myJson.tiles
            );
            // TODO also preallocate the Fused data texture
          }

          view3D.removeAllVolumes();
          view3D.addVolume(myState.volume);
          view3D.setVolumeRenderMode(myState.isPT ? RENDERMODE_PATHTRACE : RENDERMODE_RAYMARCH);
          // first 3 channels for starters
          for (let ch = 0; ch < myState.volume.num_channels; ++ch) {
            view3D.setVolumeChannelEnabled(myState.volume, ch, ch < 3);
          }
          view3D.setVolumeChannelAsMask(myState.volume, myJson.channel_names.indexOf("SEG_Memb"));
          view3D.updateActiveChannels(myState.volume);
          view3D.updateLuts(myState.volume);
          view3D.updateLights(myState.lights);
          view3D.updateDensity(myState.volume, myState.density / 100.0);
          view3D.updateExposure(myState.exposure);
          // apply a volume transform from an external source:
          if (myJson.userData && myJson.userData.alignTransform) {
            view3D.setVolumeTranslation(
              myState.volume,
              myState.volume.voxelsToWorldSpace(myJson.userData.alignTransform.translation)
            );
            view3D.setVolumeRotation(myState.volume, myJson.userData.alignTransform.rotation);
          }

          myState.currentFrame = 0;
          showChannelUI(myState.volume);
        }

        VolumeLoader.loadVolumeAtlasData(currentVol, myJson.images, (url, channelIndex) => {
          currentVol.channels[channelIndex].lutGenerator_percentiles(0.5, 0.998);

          if (currentVol.isLoaded()) {
            console.log("currentVol with name" + currentVol.name + " is loaded");
            myState.numberOfVolumesCached++;
            if (myState.numberOfVolumesCached >= myState.totalFrames) {
              console.log("ALL FRAMES RECEIVED");
            }

            if (frameNumber === 0) {
              copyVolumeToVolume(currentVol, myState.volume);
              // has assumption that only 3 channels
              view3D.onVolumeData(myState.volume, [0, 1, 2]);
              view3D.updateActiveChannels(myState.volume);
              view3D.updateLuts(myState.volume);

              myState.volume.setIsLoaded(true);
            }
          }
        });
      } else {
        loadImageData(myJson);
      }
    });
}

function fetchTimeSeries(urlStart, urlEnd, t0, tf, interval = 1) {
  let frameNumber = 0;
  for (let t = t0; t <= tf; t += interval) {
    fetchImage(urlStart + t + urlEnd, true, frameNumber);
    frameNumber++;
  }
  myState.totalFrames = frameNumber;
  console.log(`${frameNumber} frames requested`);
}

function copyVolumeToVolume(src, dest) {
  // assumes volumes already have identical dimensions!!!

  // grab references to data from each channel and put it in myState.volume
  for (let i = 0; i < src.num_channels; ++i) {
    // dest.channels[i].imgData.data.set(src.channels[i].imgData.data);
    // dest.channels[i].volumeData.set(src.channels[i].volumeData);
    // dest.channels[i].lut.set(src.channels[i].lut);
    dest.channels[i].imgData = {
      data: src.channels[i].imgData.data,
      width: src.channels[i].imgData.width,
      height: src.channels[i].imgData.height,
    };
    dest.channels[i].volumeData = src.channels[i].volumeData;
    dest.channels[i].lut = src.channels[i].lut;

    // danger: not a copy!
    dest.channels[i].histogram = src.channels[i].histogram;
    dest.channels[i].dataTexture = src.channels[i].dataTexture;
    dest.channels[i].lutTexture = src.channels[i].lutTexture;
    dest.channels[i].loaded = true;
  }
}

function updateViewForNewVolume() {
  view3D.onVolumeData(myState.volume, [0, 1, 2]);
  myState.volume.setIsLoaded(true);

  if (myState.isPT) {
    view3D.updateActiveChannels(myState.volume);
  } else {
    view3D.updateLuts(myState.volume);
  }

  for (let i = 0; i < myState.volume.num_channels; ++i) {
    view3D.updateIsosurface(myState.volume, i, myState.channelGui[i].isovalue);
  }
}

function playTimeSeries() {
  clearInterval(myState.timerId);

  const loadNextFrame = () => {
    if (myState.currentFrame >= myState.totalFrames - 1) {
      clearInterval(myState.timerId);
      console.log("Reached end of sequence");
      return;
    }
    const nextFrame = myState.currentFrame + 1;
    const nextFrameVolume = myState.timeSeriesVolumes[nextFrame];
    //console.log("loadNextFrame at " + nextFrame);

    copyVolumeToVolume(nextFrameVolume, myState.volume);
    updateViewForNewVolume();
    myState.currentFrame = nextFrame;
  };
  myState.timerId = window.setInterval(loadNextFrame, 80);
}

function goToFrame(targetFrame) {
  console.log("going to Frame " + targetFrame);
  const outOfBounds = targetFrame > myState.totalFrames - 1 || targetFrame < 0;
  if (outOfBounds) {
    console.log("frame out of bounds");
    return;
  }

  const targetFrameVolume = myState.timeSeriesVolumes[targetFrame];

  copyVolumeToVolume(targetFrameVolume, myState.volume);
  updateViewForNewVolume();
  myState.currentFrame = targetFrame;
}

function createTestVolume() {
  const imgData = {
    // width := original full size image width
    width: 64,
    // height := original full size image height
    height: 64,
    channels: 3,
    channel_names: ["DRAQ5", "EGFP", "SEG_Memb"],
    rows: 8,
    cols: 8,
    // tiles <= rows*cols, tiles is number of z slices
    tiles: 64,
    tile_width: 64,
    tile_height: 64,

    // These dimensions are used to prepare the raw volume arrays for rendering as tiled texture atlases
    // for webgl reasons, it is best for atlas_width and atlas_height to be <= 2048
    // and ideally a power of 2. (adjust other dimensions accordingly)
    // atlas_width === cols*tile_width
    atlas_width: 512,
    // atlas_height === rows*tile_height
    atlas_height: 512,

    pixel_size_x: 1,
    pixel_size_y: 1,
    pixel_size_z: 1,
    name: "AICS-10_5_5",
    status: "OK",
    version: "0.0.0",
    aicsImageVersion: "0.3.0",
  };
  // generate some raw volume data
  const channelVolumes = [
    VolumeMaker.createSphere(imgData.tile_width, imgData.tile_height, imgData.tiles, 24),
    VolumeMaker.createTorus(imgData.tile_width, imgData.tile_height, imgData.tiles, 24, 8),
    VolumeMaker.createCone(imgData.tile_width, imgData.tile_height, imgData.tiles, 24, 24),
  ];
  return {
    imgData: imgData,
    volumeData: channelVolumes,
  };
}

function main() {
  const el = document.getElementById("volume-viewer");
  if (!el) {
    return;
  }
  view3D = new View3d(el);

  const xBtn = document.getElementById("X");
  xBtn?.addEventListener("click", () => {
    view3D.setCameraMode("X");
  });
  const yBtn = document.getElementById("Y");
  yBtn?.addEventListener("click", () => {
    view3D.setCameraMode("Y");
  });
  const zBtn = document.getElementById("Z");
  zBtn?.addEventListener("click", () => {
    view3D.setCameraMode("Z");
  });
  const d3Btn = document.getElementById("3D");
  d3Btn?.addEventListener("click", () => {
    view3D.setCameraMode("3D");
  });
  const rotBtn = document.getElementById("rotBtn");
  rotBtn?.addEventListener("click", () => {
    myState.isTurntable = !myState.isTurntable;
    view3D.setAutoRotate(myState.isTurntable);
  });
  const axisBtn = document.getElementById("axisBtn");
  axisBtn?.addEventListener("click", () => {
    myState.isAxisShowing = !myState.isAxisShowing;
    view3D.setShowAxis(myState.isAxisShowing);
  });
  const showBoundsBtn = document.getElementById("showBoundingBox");
  showBoundsBtn?.addEventListener("click", () => {
    myState.showBoundingBox = !myState.showBoundingBox;
    view3D.setShowBoundingBox(myState.volume, myState.showBoundingBox);
  });
  const boundsColorBtn = document.getElementById("boundingBoxColor");
  boundsColorBtn?.addEventListener("change", (event: Event) => {
    // convert value to rgb array
    function hexToRgb(hex, last: [number, number, number]): [number, number, number] {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? [parseInt(result[1], 16) / 255.0, parseInt(result[2], 16) / 255.0, parseInt(result[3], 16) / 255.0]
        : last;
    }

    myState.boundingBoxColor = hexToRgb((event.target as HTMLInputElement)?.value, myState.boundingBoxColor);
    view3D.setBoundingBoxColor(myState.volume, myState.boundingBoxColor);
  });

  const flipXBtn = document.getElementById("flipXBtn");
  flipXBtn?.addEventListener("click", () => {
    myState.flipX *= -1;
    view3D.setFlipVolume(myState.volume, myState.flipX, myState.flipY, myState.flipZ);
  });
  const flipYBtn = document.getElementById("flipYBtn");
  flipYBtn?.addEventListener("click", () => {
    myState.flipY *= -1;
    view3D.setFlipVolume(myState.volume, myState.flipX, myState.flipY, myState.flipZ);
  });
  const flipZBtn = document.getElementById("flipZBtn");
  flipZBtn?.addEventListener("click", () => {
    myState.flipZ *= -1;
    view3D.setFlipVolume(myState.volume, myState.flipX, myState.flipY, myState.flipZ);
  });
  const playBtn = document.getElementById("playBtn");
  playBtn?.addEventListener("click", () => {
    if (myState.currentFrame >= myState.totalFrames - 1) {
      myState.currentFrame = -1;
    }
    playTimeSeries();
  });
  const pauseBtn = document.getElementById("pauseBtn");
  pauseBtn?.addEventListener("click", () => {
    clearInterval(myState.timerId);
  });
  const forwardBtn = document.getElementById("forwardBtn");
  forwardBtn?.addEventListener("click", () => {
    goToFrame(myState.currentFrame + 1);
  });
  const backBtn = document.getElementById("backBtn");
  backBtn?.addEventListener("click", () => {
    goToFrame(myState.currentFrame - 1);
  });

  const alignBtn = document.getElementById("xfBtn");
  alignBtn?.addEventListener("click", () => {
    myState.isAligned = !myState.isAligned;
    view3D.setVolumeTranslation(myState.volume, myState.isAligned ? myState.volume.getTranslation() : [0, 0, 0]);
    view3D.setVolumeRotation(myState.volume, myState.isAligned ? myState.volume.getRotation() : [0, 0, 0]);
  });
  const resetCamBtn = document.getElementById("resetCamBtn");
  resetCamBtn?.addEventListener("click", () => {
    view3D.resetCamera();
  });
  const counterSpan = document.getElementById("counter");
  if (counterSpan) {
    view3D.setRenderUpdateListener((count) => {
      counterSpan.innerHTML = "" + count;
    });
  }

  if (view3D.hasWebGL2()) {
    const ptBtn = document.getElementById("ptBtn") as HTMLButtonElement;
    ptBtn.disabled = false;
    ptBtn.addEventListener("click", () => {
      myState.isPT = !myState.isPT;
      view3D.setVolumeRenderMode(myState.isPT ? RENDERMODE_PATHTRACE : RENDERMODE_RAYMARCH);
      view3D.updateLights(myState.lights);
    });
  }
  const screenshotBtn = document.getElementById("screenshotBtn");
  screenshotBtn?.addEventListener("click", () => {
    view3D.capture((dataUrl) => {
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = "screenshot.png";
      anchor.click();
    });
  });

  setupGui();

  const loadTimeSeries = true;
  const loadTestData = false;

  if (loadTimeSeries) {
    fetchTimeSeries(
      "http://dev-aics-dtp-001.corp.alleninstitute.org/dan-data/test_parent_T49.ome_",
      "_atlas.json",
      0,
      46
    );
  } else if (loadTestData) {
    fetchImage("AICS-12_881_atlas.json");
  } else {
    const volumeInfo = createTestVolume();
    loadImageData(volumeInfo.imgData, volumeInfo.volumeData);
  }
  console.log(myState.timeSeriesVolumes);
}

document.body.onload = () => {
  main();
};
