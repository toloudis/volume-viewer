import {
    AICSview3d,
    AICSview3d_PT,
    AICSvolumeDrawable,
    AICSmakeVolumes,
    AICSvolumeLoader
} from '../src';

let el = document.getElementById("volume-viewer");
let view3D = new AICSview3d_PT(el);
//let view3D = new AICSview3d(el);

// TODO FIX ME : run this code after we know that the page has rendered, 
// so that the view3D can get size from el
view3D.resize(null, 1032, 915);

const presets = {
    // channel window, level
    "AICS-11_409_atlas.json":  [ [1,0.624], [1,0.933], [0.509, 0.869] ],
    "AICS-12_881_atlas.json": [ [1,0.585], [1,0.734], [0.534, 0.844] ],
    "AICS-13_319_atlas.json": [ [1,0.568], [1,0.666], [0.509, 0.912] ]
};

// generate some raw volume data
// PREPARE SOME TEST DATA TO TRY TO DISPLAY A VOLUME.
// let imgdata = {
//     "channels": 9,
//     "tiles": 65,
//     "tile_width": 204,
//     "tile_height": 292,
// };
// var channelVolumes = [];
// for (var i = 0; i < imgdata.channels; ++i) {
//   if (i % 2 === 0) {
//     var sv = AICSmakeVolumes.createSphere(imgdata.tile_width, imgdata.tile_height, imgdata.tiles, 16);
//     channelVolumes.push(sv);
//   }
//   else{
//     var sv = AICSmakeVolumes.createTorus(imgdata.tile_width, imgdata.tile_height, imgdata.tiles, 32, 8);
//     channelVolumes.push(sv);

//   }
// }

const myState = {
    file: "",
    density: 50.0,
    exposure: 0.75,
    aperture: 0.0,
    fov: 20,
    focal_distance: 4.0,
    skyTopIntensity: 1.0,
    skyMidIntensity: 1.0,
    skyBotIntensity: 1.0,
    skyTopColor: [255, 255, 255],
    skyMidColor: [255, 255, 255],
    skyBotColor: [255, 255, 255],
    lightColor: [255, 255, 255],
    lightIntensity: 100.0,
    lightDistance: 10.0,
    lightTheta: 0.0,
    lightPhi: 0.0,
    lightSize: 1.0,
    xmin: 0.0,
    ymin: 0.0,
    zmin: 0.0,
    xmax: 1.0,
    ymax: 1.0,
    zmax: 1.0
};
let gui = null;

function setupGui() {

    gui = new dat.GUI();
    //gui = new dat.GUI({autoPlace:false, width:200});

    gui.add(myState, "density").max(100.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateDensity(value);
    });

    var cameragui = gui.addFolder("Camera");
    cameragui.add(myState, "exposure").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateExposure(value);
    });
    cameragui.add(myState, "aperture").max(0.1).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateCamera(myState.fov, myState.focal_distance, myState.aperture);
    });
    cameragui.add(myState, "focal_distance").max(5.0).min(0.1).step(0.001).onChange(function (value) {
        view3D.updateCamera(myState.fov, myState.focal_distance, myState.aperture);
    });
    cameragui.add(myState, "fov").max(90.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateCamera(myState.fov, myState.focal_distance, myState.aperture);
    });

    var clipping = gui.addFolder("Clipping Box");
    clipping.add(myState, "xmin").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });
    clipping.add(myState, "xmax").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });
    clipping.add(myState, "ymin").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });
    clipping.add(myState, "ymax").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });
    clipping.add(myState, "zmin").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });
    clipping.add(myState, "zmax").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });

    var lighting = gui.addFolder("Lighting");
    lighting.addColor(myState, "skyTopColor").name("Sky Top").onChange(function (value) {
        view3D.updateLights(myState);
    });
    lighting.add(myState, "skyTopIntensity").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        view3D.updateLights(myState);
    });
    lighting.addColor(myState, "skyMidColor").name("Sky Mid").onChange(function (value) {
        view3D.updateLights(myState);
    });
    lighting.add(myState, "skyMidIntensity").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        view3D.updateLights(myState);
    });
    lighting.addColor(myState, "skyBotColor").name("Sky Bottom").onChange(function (value) {
        view3D.updateLights(myState);
    });
    lighting.add(myState, "skyBotIntensity").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        view3D.updateLights(myState);
    });
    lighting.add(myState, "lightDistance").max(100.0).min(0.0).step(0.1).onChange(function (value) {
        view3D.updateLights(myState);
    });
    lighting.add(myState, "lightTheta").max(180.0).min(-180.0).step(1).onChange(function (value) {
        view3D.updateLights(myState);
    });
    lighting.add(myState, "lightPhi").max(180.0).min(0.0).step(1).onChange(function (value) {
        view3D.updateLights(myState);
    });
    lighting.add(myState, "lightSize").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        view3D.updateLights(myState);
    });
    lighting.add(myState, "lightIntensity").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        view3D.updateLights(myState);
    });
    lighting.addColor(myState, "lightColor").name("lightcolor").onChange(function (value) {
        view3D.updateLights(myState);
    });

}

dat.GUI.prototype.removeFolder = function (name) {
    var folder = this.__folders[name];
    if (!folder) {
        return;
    }
    folder.close();
    this.__ul.removeChild(folder.domElement.parentNode);
    delete this.__folders[name];
    this.onResize();
}

function showChannelUI(img) {

    if (myState && myState.channelFolderNames) {
        for (var i = 0; i < myState.channelFolderNames.length; ++i) {
            gui.removeFolder(myState.channelFolderNames[i]);
        }
    }
    
    myState.infoObj = img.volume.imageInfo;

    myState.infoObj.channelGui = [];
    const initcolors = [
        [255, 0, 255],
        [255, 255, 255],
        [0, 255, 255]
    ];
    myState.channelFolderNames = []
    for (var i = 0; i < myState.infoObj.channels; ++i) {
        myState.infoObj.channelGui.push({
            colorD: (i < 3) ? initcolors[i] : [255, 255, 255],
            colorS: [0, 0, 0],
            colorE: [0, 0, 0],
            window: 1.0,
            level: 0.5,
            roughness: 0.0,
            enabled: true,
            // this doesn't give good results currently but is an example of a per-channel button callback
            autoIJ: (function(j) {
                return function() {
                    view3D.image.volume.channels[j].lutGenerator_auto2();
                    view3D.updateLuts();
                }
            })(i)
        });
        var f = gui.addFolder("Channel " + myState.infoObj.channel_names[i]);
        myState.channelFolderNames.push("Channel " + myState.infoObj.channel_names[i]);
        f.add(myState.infoObj.channelGui[i], "enabled").onChange(function (j) {
            return function (value) {
                view3D.image.setVolumeChannelEnabled(j, value ? true : false);
                view3D.updateActiveChannels();
            };
        }(i));
        f.addColor(myState.infoObj.channelGui[i], "colorD").name("Diffuse").onChange(function (j) {
            return function (value) {
                view3D.image.updateChannelMaterial(
                    j,
                    myState.infoObj.channelGui[j].colorD,
                    myState.infoObj.channelGui[j].colorS,
                    myState.infoObj.channelGui[j].colorE,
                    myState.infoObj.channelGui[j].roughness
                );
                view3D.updateMaterial();
            };
        }(i));
        f.addColor(myState.infoObj.channelGui[i], "colorS").name("Specular").onChange(function (j) {
            return function (value) {
                view3D.image.updateChannelMaterial(
                    j,
                    myState.infoObj.channelGui[j].colorD,
                    myState.infoObj.channelGui[j].colorS,
                    myState.infoObj.channelGui[j].colorE,
                    myState.infoObj.channelGui[j].roughness
                );
                view3D.updateMaterial();
            };
        }(i));
        f.addColor(myState.infoObj.channelGui[i], "colorE").name("Emissive").onChange(function (j) {
            return function (value) {
                view3D.image.updateChannelMaterial(
                    j,
                    myState.infoObj.channelGui[j].colorD,
                    myState.infoObj.channelGui[j].colorS,
                    myState.infoObj.channelGui[j].colorE,
                    myState.infoObj.channelGui[j].roughness
                );
                view3D.updateMaterial();
            };
        }(i));
        f.add(myState.infoObj.channelGui[i], "window").max(1.0).min(0.0).step(0.001).onChange(function (j) {
                return function (value) {
                    view3D.image.volume.channels[j].lutGenerator_windowLevel(value, myState.infoObj.channelGui[j].level);
                    view3D.updateLuts();
                }
            }(i));

        f.add(myState.infoObj.channelGui[i], "level").max(1.0).min(0.0).step(0.001).onChange(function (j) {
                return function (value) {
                    view3D.image.volume.channels[j].lutGenerator_windowLevel(myState.infoObj.channelGui[j].window, value);
                    view3D.updateLuts();
                }
            }(i));
        //f.add(myState.infoObj.channelGui[i], 'autoIJ');
        f.add(myState.infoObj.channelGui[i], "roughness").max(100.0).min(0.0).onChange(function (j) {
                return function (value) {
                    view3D.image.updateChannelMaterial(
                        j,
                        myState.infoObj.channelGui[j].colorD,
                        myState.infoObj.channelGui[j].colorS,
                        myState.infoObj.channelGui[j].colorE,
                        myState.infoObj.channelGui[j].roughness
                    );
                    view3D.updateMaterial();
                }
            }(i));

    }

}

function loadImageData(jsondata, volumedata) {

    const aimg = new AICSvolumeDrawable(jsondata);

    // tell the viewer about the image
    view3D.setImage(aimg);

    // get data into the image
    if (volumedata) {
        for (var i = 0; i < volumedata.length; ++i) {
            // where each volumedata element is a flat Uint8Array of xyz data
            // according to jsondata.tile_width*jsondata.tile_height*jsondata.tiles
            // (first row of first plane is the first data in 
            // the layout, then second row of first plane, etc)
            aimg.setChannelDataFromVolume(i, volumedata[i]);
        }
    }
    else {
        AICSvolumeLoader.loadVolumeAtlasData(jsondata.images, (url, channelIndex, atlasdata, atlaswidth, atlasheight) => {
            aimg.setChannelDataFromAtlas(channelIndex, atlasdata, atlaswidth, atlasheight);
            // if (aimg.volume.loaded) {
            //     aimg.setChannelAsMask(5);
            //     aimg.setUniform('maskAlpha', 0.0);
            // }

            if (jsondata.preset) {
                let p = jsondata.preset;
                if (p[channelIndex]) {
                    aimg.volume.channels[channelIndex].lutGenerator_windowLevel(p[channelIndex][0], p[channelIndex][1]);
                }
            }
    
        });
    }

    showChannelUI(aimg);

    view3D.setCameraMode('3D');
    aimg.setDensity(0.1);
    aimg.setBrightness(1.0);
}

var xbtn = document.getElementById("X");
xbtn.addEventListener("click", ()=>{view3D.setCameraMode('X');});
var ybtn = document.getElementById("Y");
ybtn.addEventListener("click", ()=>{view3D.setCameraMode('Y');});
var zbtn = document.getElementById("Z");
zbtn.addEventListener("click", ()=>{view3D.setCameraMode('Z');});
var d3btn = document.getElementById("3D");
d3btn.addEventListener("click", ()=>{view3D.setCameraMode('3D');});
var isRot = false;
var rotbtn = document.getElementById("rotbtn");
rotbtn.addEventListener("click", ()=>{isRot = !isRot; view3D.setAutoRotate(isRot)});
var isAxis = false;
var axisbtn = document.getElementById("axisbtn");
axisbtn.addEventListener("click", ()=>{isAxis = !isAxis; view3D.setShowAxis(isAxis)});

setupGui();

//loadImageData(imgdata, channelVolumes);

// switch the uncommented line to test with volume data or atlas data
const urlParams = new URLSearchParams(window.location.search);
const nameToLoad = urlParams.get('name');
if (nameToLoad) {
    const cellline = nameToLoad.split('_')[0];
    const prefixdir = 'http://dev-aics-dtp-001/cellviewer-1-3-0/Cell-Viewer_Thumbnails/' + cellline + '/';
    fetch(prefixdir + nameToLoad + '_atlas.json')
    .then(function(response) {
      return response.json();
    })
    .then(function(myJson) {
        // prefix all the names in myJson.images
        myJson.images.forEach(function(element) {
            element.name = prefixdir + element.name;
        });
        loadImageData(myJson);
    });  
}
else {
    var cellselecter = document.getElementById("cellselecter");
    cellselecter.addEventListener("change", (e)=> {
        fetch(cellselecter.value)
        .then(function(response) {
          return response.json();
        })
        .then(function(myJson) {
            if (view3D.volumeTexture) {
                view3D.volumeTexture.dispose();
                view3D.volumeTexture = null;
            }
    
            let p = presets[cellselecter.value];
            myJson.preset = p;
            loadImageData(myJson);
        });  
    });
}

