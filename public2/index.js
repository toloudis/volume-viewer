import {
    AICSview3d,
    AICSvolumeDrawable,
    AICSmakeVolumes,
    AICSvolumeLoader,
    Light,
    AREA_LIGHT,
    SKY_LIGHT
} from '../src';

let el = document.getElementById("volume-viewer");
//let view3D = new AICSview3d_PT(el);
let view3D = new AICSview3d(el);

// TODO FIX ME : run this code after we know that the page has rendered, 
// so that the view3D can get size from el
view3D.resize(null, 1032, 915);

const dataset = {
    prefixdir: "april/",
    stages: ["M1", "M2", "M3", "M4", "M5", "M6", "M7"],
    names: ["ACTB", "ACTN1", "CENT2", "DSP", "FBL", "LAMP1", "LMNB1", "MYH10", "PMP34", "SEC61B", "ST6GAL1", "TJP1", "TOMM20", "TUBA1B"],
    types: ["raw", "seg"]
};

const preset_name = "M7";

function make_name(stage, name, type) {
    return "COMP_" + stage + "_atlas.json";
}
function getChannelIndexOfStructure(ms) {
    if (ms === "NUC") {
        return 1;
    }
    if (ms === "MEM") {
        return 0;
    }
    return dataset.names.indexOf(ms) * 2 + 2;
}

const myState = {
    file: "",
    density: 50.0,
    maskAlpha: 1.0,
    exposure: 0.9,
    aperture: 0.0,
    fov: 20,
    focal_distance: 4.0,

    lights: [new Light(SKY_LIGHT), new Light(AREA_LIGHT)],

    skyTopIntensity: 0.5,
    skyMidIntensity: 1.25,
    skyBotIntensity: 0.5,
    skyTopColor: [255, 255, 255],
    skyMidColor: [255, 255, 255],
    skyBotColor: [255, 255, 255],

    lightColor: [255, 255, 255],
    lightIntensity: 50.0,
    lightTheta: 0.0,
    lightPhi: 0.0,
    
    xmin: 0.0,
    ymin: 0.0,
    zmin: 0.0,
    xmax: 1.0,
    ymax: 1.0,
    zmax: 1.0,

    selected_stage: 0,
    selected_seg: 0,
    structs_enabled: [true, true, true, true, true, true, true, true, true, true, true, true, true, true],

    loadedImages: {},

    m7: {
        windowMT: 0.455,
        levelMT: 0.598,
        windowNuc: 0.488,
        levelNuc: 0.885
    }

};
let gui = null;

function setupGui() {

    gui = new dat.GUI();
    //gui = new dat.GUI({autoPlace:false, width:200});

    gui.add(myState, "density").max(100.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateDensity(value);
    });
    gui.add(myState, "maskAlpha").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.image.setMaskAlpha(value);
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
        myState.lights[0].m_colorTop = new THREE.Vector3(
            myState.skyTopColor[0]/255.0*myState.skyTopIntensity,
            myState.skyTopColor[1]/255.0*myState.skyTopIntensity,
            myState.skyTopColor[2]/255.0*myState.skyTopIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "skyTopIntensity").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        myState.lights[0].m_colorTop = new THREE.Vector3(
            myState.skyTopColor[0]/255.0*myState.skyTopIntensity,
            myState.skyTopColor[1]/255.0*myState.skyTopIntensity,
            myState.skyTopColor[2]/255.0*myState.skyTopIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.addColor(myState, "skyMidColor").name("Sky Mid").onChange(function (value) {
        myState.lights[0].m_colorMiddle = new THREE.Vector3(
            myState.skyMidColor[0]/255.0*myState.skyMidIntensity,
            myState.skyMidColor[1]/255.0*myState.skyMidIntensity,
            myState.skyMidColor[2]/255.0*myState.skyMidIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "skyMidIntensity").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        myState.lights[0].m_colorMiddle = new THREE.Vector3(
            myState.skyMidColor[0]/255.0*myState.skyMidIntensity,
            myState.skyMidColor[1]/255.0*myState.skyMidIntensity,
            myState.skyMidColor[2]/255.0*myState.skyMidIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.addColor(myState, "skyBotColor").name("Sky Bottom").onChange(function (value) {
        myState.lights[0].m_colorBottom = new THREE.Vector3(
            myState.skyBotColor[0]/255.0*myState.skyBotIntensity,
            myState.skyBotColor[1]/255.0*myState.skyBotIntensity,
            myState.skyBotColor[2]/255.0*myState.skyBotIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "skyBotIntensity").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        myState.lights[0].m_colorBottom = new THREE.Vector3(
            myState.skyBotColor[0]/255.0*myState.skyBotIntensity,
            myState.skyBotColor[1]/255.0*myState.skyBotIntensity,
            myState.skyBotColor[2]/255.0*myState.skyBotIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState.lights[1], "m_distance").max(10.0).min(0.0).step(0.1).onChange(function (value) {
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "lightTheta").max(180.0).min(-180.0).step(1).onChange(function (value) {
        myState.lights[1].m_theta = value * 3.14159265 / 180.0;
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "lightPhi").max(180.0).min(0.0).step(1).onChange(function (value) {
        myState.lights[1].m_phi = value * 3.14159265 / 180.0;
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState.lights[1], "m_width").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        myState.lights[1].m_width = value;
        myState.lights[1].m_height = value;
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "lightIntensity").max(1000.0).min(0.01).step(0.1).onChange(function (value) {
        myState.lights[1].m_color = new THREE.Vector3(
            myState.lightColor[0]/255.0*myState.lightIntensity,
            myState.lightColor[1]/255.0*myState.lightIntensity,
            myState.lightColor[2]/255.0*myState.lightIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.addColor(myState, "lightColor").name("lightcolor").onChange(function (value) {
        myState.lights[1].m_color = new THREE.Vector3(
            myState.lightColor[0]/255.0*myState.lightIntensity,
            myState.lightColor[1]/255.0*myState.lightIntensity,
            myState.lightColor[2]/255.0*myState.lightIntensity
        );
        view3D.updateLights(myState.lights);
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
};

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
        [0, 255, 255],
        [255, 255, 255]
    ];
    const initlevels = [
        [0.5, 0.5],
        [0.5, 0.8],
        [0.5, 0.8]
    ];
    myState.channelFolderNames = [];
    for (var i = 0; i < myState.infoObj.channels; ++i) {
        myState.infoObj.channelGui.push({
            colorD: (i < 3) ? initcolors[i] : [255, 255, 255],
            colorS: [0, 0, 0],
            colorE: [0, 0, 0],
            window: initlevels[i][0],
            level: initlevels[i][1],
            roughness: 0.0,
            enabled: true,
            // this doesn't give good results currently but is an example of a per-channel button callback
            autoIJ: (function(j) {
                return function() {
                    view3D.image.volume.channels[j].lutGenerator_auto2();
                    view3D.updateLuts();
                };
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
                };
            }(i));

        f.add(myState.infoObj.channelGui[i], "level").max(1.0).min(0.0).step(0.001).onChange(function (j) {
                return function (value) {
                    view3D.image.volume.channels[j].lutGenerator_windowLevel(myState.infoObj.channelGui[j].window, value);
                    view3D.updateLuts();
                };
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
                };
            }(i));

    }

}

// raw or seg: 0 or 1
function toggle_raw_seg(raw_or_seg) {
    // switch off mem and nuc
    view3D.image.setVolumeChannelEnabled(0, false);
    view3D.image.setVolumeChannelEnabled(1, false);

    for (let i = 0; i < dataset.names.length; ++i) {
        view3D.image.setVolumeChannelEnabled(2 + (i*2), !raw_or_seg && myState.structs_enabled[i]);
        view3D.image.setVolumeChannelEnabled(2 + (i*2)+1, raw_or_seg && myState.structs_enabled[i]);
    }
    view3D.updateActiveChannels();

    // show raw at lower density value than seg
    myState.density = raw_or_seg ? 50.0 : 7.0;
    view3D.updateDensity(myState.density);

}

function enableChannels(charray) {
    for (let i = 0; i < dataset.names.length; ++i) {
        let enabled = (charray.indexOf(dataset.names[i]) > -1);
        structureCBs[i].checked = enabled;

        myState.structs_enabled[i] = enabled;

        view3D.image.setVolumeChannelEnabled(2 + (i*2), enabled && (myState.selected_seg === 0));
        view3D.image.setVolumeChannelEnabled(2 + (i*2)+1 , enabled && (myState.selected_seg !== 0));
    }

    view3D.image.setVolumeChannelEnabled(0, charray.indexOf("MEM") > -1);
    view3D.image.setVolumeChannelEnabled(1, charray.indexOf("NUC") > -1);

    view3D.updateActiveChannels();
}

function switchToImage(aimg) {
    if (!aimg) {
        return false;
    }

    // tell the viewer about the image
    view3D.setImage(aimg);
    
    view3D.setPathTrace(isPT);
    toggle_raw_seg(myState.selected_seg);

    view3D.updateActiveChannels();
    //aimg.setChannelAsMask(5);
    //aimg.setMaskAlpha(1.0);
    view3D.updateLuts();
    view3D.updateLights(myState.lights);
    view3D.updateExposure(myState.exposure);

    return true;
}

function onImageFullyLoaded(aimg) {
    // these names are suffixed by "_M#"
    const phasename = aimg.volume.name.substr(aimg.volume.name.lastIndexOf("_")+1);

    myState.loadedImages[phasename] = aimg;

    // find option in the select and enable it.
    for ( var i = 0, len = stageselecter.options.length; i < len; i++ ) {
        const opt = stageselecter.options[i];
        if (opt.value === phasename) {
            opt.disabled = false;
            break;
        }
    }

    console.log(phasename + " LOADED");

    if (phasename === "M1") {
        switchToImage(aimg);
    }

    if (phasename === preset_name) {
        var f = gui.addFolder("PRESET_PT");
        f.add(myState.m7, "windowMT").max(1.0).min(0.0).step(0.001).onChange(function (j) {
            return function (value) {
                const indexTUBA1B = getChannelIndexOfStructure("TUBA1B");
                myState.loadedImages[preset_name].volume.channels[indexTUBA1B].lutGenerator_windowLevel(value, myState.m7.levelMT);
                view3D.updateLuts();
            };
        }(i));
        f.add(myState.m7, "levelMT").max(1.0).min(0.0).step(0.001).onChange(function (j) {
            return function (value) {
                const indexTUBA1B = getChannelIndexOfStructure("TUBA1B");
                myState.loadedImages[preset_name].volume.channels[indexTUBA1B].lutGenerator_windowLevel(myState.m7.windowMT, value);
                view3D.updateLuts();
            };
        }(i));
        f.add(myState.m7, "windowNuc").max(1.0).min(0.0).step(0.001).onChange(function (j) {
            return function (value) {
                const indexNuc = getChannelIndexOfStructure("NUC");
                myState.loadedImages[preset_name].volume.channels[indexNuc].lutGenerator_windowLevel(value, myState.m7.levelNuc);
                view3D.updateLuts();
            };
        }(i));
        f.add(myState.m7, "levelNuc").max(1.0).min(0.0).step(0.001).onChange(function (j) {
            return function (value) {
                const indexNuc = getChannelIndexOfStructure("NUC");
                myState.loadedImages[preset_name].volume.channels[indexNuc].lutGenerator_windowLevel(myState.m7.windowNuc, value);
                view3D.updateLuts();
            };
        }(i));

    }
}

function loadImageData(jsondata, onFullyLoaded) {

    // PRESET
    jsondata.pixel_size_x = 1.0;
    jsondata.pixel_size_y = 1.0;
    jsondata.pixel_size_z = 2.9;
    // if (rawselecter.value === "seg") {
    //     jsondata.channel_colors = [
    //         [128, 0, 128],
    //         [0, 255, 255],
    //         [255, 255, 255]
    //     ];
    // }
    // else {
    //     jsondata.channel_colors = [
    //         [128, 0, 128],
    //         [0, 255, 255],
    //         [255, 255, 255]
    //     ];
    // }

    const aimg = new AICSvolumeDrawable(jsondata, isPT);
    AICSvolumeLoader.loadVolumeAtlasData(jsondata.images, (url, channelIndex, atlasdata, atlaswidth, atlasheight) => {

        aimg.setVolumeChannelEnabled(channelIndex, true);

        aimg.setChannelDataFromAtlas(channelIndex, atlasdata, atlaswidth, atlasheight);

        if (rawselecter.value === "seg") {
            aimg.volume.channels[channelIndex].lutGenerator_windowLevel(1.0, 0.5);
        }
        else{
            aimg.volume.channels[channelIndex].lutGenerator_auto2();
        }

        if (aimg.volume.loaded) {
            onFullyLoaded(aimg);
        }

    });

    //showChannelUI(aimg);

    //view3D.setCameraMode('3D');
    //aimg.setBrightness(myState.exposure);
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
rotbtn.addEventListener("click", ()=>{isRot = !isRot; view3D.setAutoRotate(isRot);});
var isAxis = false;
var axisbtn = document.getElementById("axisbtn");
axisbtn.addEventListener("click", ()=>{isAxis = !isAxis; view3D.setShowAxis(isAxis);});
var isPT = false;
if (view3D.canvas3d.hasWebGL2) {
    var ptbtn = document.createElement("button");
    ptbtn.setAttribute("id", "ptbtn");
    var t = document.createTextNode("Pathtrace");
    ptbtn.appendChild(t);

    //var ptbtn = document.getElementById("ptbtn");
    ptbtn.addEventListener("click", ()=>{
        isPT = !isPT; 
        view3D.setPathTrace(isPT);
        view3D.updateLights(myState.lights);
    });

    axisbtn.parentNode.insertBefore(ptbtn, axisbtn.nextSibling);
}

setupGui();

// switch the uncommented line to test with volume data or atlas data
var stageselecter = document.getElementById("phaseselecter");
var rawselecter = document.getElementById("rawselecter");

function loadnewcell(stage, structure, raw) {
    const url = make_name(stage, structure, raw);
    fetch(dataset.prefixdir+url)
    .then(function(response) {
      return response.json();
    })
    .then(function(myJson) {
        if (view3D.volumeTexture) {
            view3D.volumeTexture.dispose();
            view3D.volumeTexture = null;
        }
        // prefix all the names in myJson.images
        myJson.images.forEach(function(element) {
            element.name = dataset.prefixdir + element.name;
        });        
        loadImageData(myJson, onImageFullyLoaded);
    });
}

// preload
loadnewcell("M1", "", rawselecter.value);
loadnewcell("M2", "", rawselecter.value);
loadnewcell("M3", "", rawselecter.value);
loadnewcell("M4", "", rawselecter.value);
loadnewcell("M5", "", rawselecter.value);
loadnewcell("M6", "", rawselecter.value);
loadnewcell("M7", "", rawselecter.value);


// arrow key implementation
document.addEventListener('keydown', function(event) {
    if (event.code === 'ArrowLeft') {
        myState.selected_stage = (myState.selected_stage + dataset.stages.length - 1) % dataset.stages.length;
        stageselecter.value=dataset.stages[myState.selected_stage];
        switchToImage(myState.loadedImages[stageselecter.value]);
    }

    if (event.code === 'ArrowRight') {
        myState.selected_stage = (myState.selected_stage + dataset.stages.length + 1) % dataset.stages.length;
        stageselecter.value=dataset.stages[myState.selected_stage];
        switchToImage(myState.loadedImages[stageselecter.value]);
    }

    if (event.code === 'KeyS') {
        myState.selected_seg = 1 - myState.selected_seg;
        rawselecter.value = dataset.types[myState.selected_seg];
        toggle_raw_seg(myState.selected_seg);
    }
});

// combo box implementation
stageselecter.addEventListener("change", (e)=> {
    myState.selected_stage = dataset.stages.indexOf(stageselecter.value);
    switchToImage(myState.loadedImages[stageselecter.value]);
    stageselecter.blur();
});
rawselecter.addEventListener("change", (e)=> {
    myState.selected_seg = dataset.types.indexOf(rawselecter.value);
    rawselecter.blur();
    toggle_raw_seg(myState.selected_seg);
});

const structureCBs = [];
for (let i = 0; i < dataset.names.length; ++i) {
    const cb = document.getElementById(dataset.names[i]);
    if (cb) {
        structureCBs[i] = cb;
        cb.addEventListener("change", (function(j) {
            return (e) => {
                myState.structs_enabled[j] = structureCBs[j].checked;
                if (myState.selected_seg === 0) {
                    view3D.image.setVolumeChannelEnabled(2 + (j*2), structureCBs[j].checked);
                }
                else {
                    view3D.image.setVolumeChannelEnabled(2 + (j*2) + 1, structureCBs[j].checked);
                }
                view3D.updateActiveChannels();
            };
        })(i) );
    }
}

const btnpreset0 = document.getElementById("PRESET_0");
btnpreset0.addEventListener("click", ()=>{
    enableChannels(["LMNB1", "TOMM20", "TUBA1B", "MYH10"]);
});
const btnpreset1 = document.getElementById("PRESET_1");
btnpreset1.addEventListener("click", ()=>{
    enableChannels(["LAMP1", "ST6GAL1", "ACTN1", "FBL"]);
});
const btnpreset2 = document.getElementById("PRESET_2");
btnpreset2.addEventListener("click", ()=>{
    if (switchToImage(myState.loadedImages[preset_name])) {
        enableChannels(["TUBA1B", "NUC"]);
        const indexTUBA1B = getChannelIndexOfStructure("TUBA1B");
        view3D.image.volume.channels[indexTUBA1B].lutGenerator_windowLevel(0.455, 0.598);
        const indexNUC = getChannelIndexOfStructure("NUC");
        view3D.image.volume.channels[indexNUC].lutGenerator_windowLevel(0.488, 0.885);
        //const indexFBL = getChannelIndexOfStructure("FBL");
        //view3D.image.volume.channels[indexFBL].lutGenerator_windowLevel(1.0, 0.9);
        view3D.updateLuts();
        view3D.setPathTrace(true);
        isPT = true;
        view3D.updateLights(myState.lights); 
        myState.density = 100;
        view3D.updateDensity(myState.density);
    }
});


