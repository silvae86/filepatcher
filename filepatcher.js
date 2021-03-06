var colors = require('colors/safe');
var fs = require('fs');
var path = require('minimist');

var arguments = {
	//target folders for the generated configuration files
	"file-to-patch" :
	{
		type: "string",
		example : "/path/to/a/file",
		tip : "Coming soon"
	},

	"patch-config" :
	{
		type: "string",
		example : "/path/to/a/file.json",
		tip : "Coming soon"
	},

	"revert" :
	{
		type: "boolean",
		example : "true|false",
		tip : "Coming soon",
		optional : true
	},

    "overwrite" :
    {
        type: "boolean",
        example : "true|false",
        tip : "Coming soon",
        optional : true
    },

    "destination-patched-file":
    {
        type: "string",
        example : "/path/to/a/file",
        tip : "Coming soon",
        optional : true
    }
};

var extensions = JSON.parse(fs.readFileSync("./extensions.json"));

var argv = require('minimist')(process.argv.slice(2));

var get_patched_text = function(patchID, patchSection, cchar)
{
    var template = "";

    template += cchar + " " + "BEGIN Autopatched section using filepatcher. Patch id: "+patchID+"\n";
    template += patchSection.after + "\n";
    template += cchar + " " + "END Autopatched section using filepatcher.\n";

    return template;
};

var apply_patch = function(text, patch, cChar)
{
    console.log("Applying patch " + patch.id);
    for(var i = 0; i < patch.patches.length; i++)
    {
        if(!patch_applied(text, patch.patches[i], cChar))
        {
            console.log("Applying patch " + i + " of " + patch.id);

            var beforeText = patch.patches[i]['before'];
            var afterText = get_patched_text(patch.id, patch.patches[i], cChar);
            text.text =  text.text.replace(beforeText, afterText);
        }
        else
        {
            console.log("Patch " + i + " of " + patch.id + " already applied. Skipping.");
        }
    }
};

var patch_applied = function(text, patchSection, patchID, cChar)
{
	var patched_version = get_patched_text(patchID, patchSection, cChar);

	if(text.text.indexOf(patched_version) > -1)
	{
		return true;
	}
	else
	{
		return false;
	}
};

var apply_patches = function(fileToBePatched, patchesFile)
{
	var fs = require('fs');
    var path = require('path');

    try
    {
        var stats = fs.statSync(fileToBePatched);
    }
    catch(e)
    {
        throw new Error("File " + fileToBePatched + " does not exist!" + "\n" + e);
    }
    if(stats.isFile())
    {
        var fileContents = fs.readFileSync(fileToBePatched, "utf8");
        var extension = path.extname(fileToBePatched);
        var cChar = extensions[extension];

        if (cChar == null)
        {
            console.error("Extension " + extension + " has no known single line comment. Set it up in the extensions.json file and run this again.");
            process.exit(1);
        }

        var patches = JSON.parse(fs.readFileSync(patchesFile, 'utf8'));

        var fileContentsPackage = {text: fileContents};

        for (var i = 0; i < patches.length; i++)
        {
            console.log("Running patch: " + colors.blue(patches[i].description));
            apply_patch(fileContentsPackage, patches[i], cChar);
        }

        //console.log(fileContents);
        return fileContentsPackage.text;
    }
};


var get_argument_by_name = function(argument)
{
	var argumentValue = null;

    if(argv[argument]){ //does our flag exist?
        argumentValue = argv[argument];
		if (arguments[argument] != null && arguments[argument].type === "boolean")
		{
			try{
				argumentValue = Boolean(argumentValue);
			}
			catch (e) {
				console.log("[ERROR] Unable to parse flag " + argument + ". It must be a boolean (true/false). " + e.message);
			}
		}
		if (arguments[argument] != null && arguments[argument].type === "integer")
		{
			try{
				argumentValue = parseInt(argumentValue);
			}
			catch (e) {
				console.log("[ERROR] Unable to parse flag " + argument + ". It must be an integer. " + e.message);
			}
		}

		if(argumentValue[0] == "-" && argumentValue[1] == "-")
		{
			console.error("Got value " + colors.red(argumentValue) + " for argument " + colors.yellow(argument) + ". This is likely due to an invalid parameter value!!");
			process.exit(1);
		}
	}

	//console.log("Got value " + argumentValue + " for argument " + argument);
	return argumentValue;
};

var detect_missing_arguments = function(arguments)
{
	var missing_arguments = [];
	var keys = Object.keys(arguments);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];

		if(
			get_argument_by_name(key) == null
		)
		{
			if(typeof arguments[key].optional != "undefined")
			{
				var boolOptional = JSON.parse(arguments[key].optional);
				if(boolOptional === false)
				{
					missing_arguments.push(key);
				}
			}
			else {
				missing_arguments.push(key);
			}
		}
	}

	return missing_arguments;
};

var print_usage = function(arguments)
{
	var missing_arguments = detect_missing_arguments(arguments);

	var output = "USAGE: " + colors.bold("build_configurations.sh") + " \n";
	var keys = Object.keys(arguments);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		output += "	--" + key + " << " + colors.cyan(arguments[key].type) + " >>";

		if(missing_arguments.indexOf(key) >= 0)
		{
			if(arguments[key].optional)
			{
				output += colors.blue(" [ OPTIONAL ]\n");
			}
			else
			{
				output += colors.red(" [ MISSING ]\n");
			}
		}
		else
		{
			output += colors.green(" [ OK ]\n");
		}
	}

	//console.log(output);
};

var missing_arguments = detect_missing_arguments(arguments);

if(missing_arguments.length == 0)
{
    if(argv.backup)
    {
        console.log("Backing up file before patch...");
    }

    if(argv.revert)
    {
        console.log("Reverting file patching...");
    }
    else
    {
        console.log("Starting file patching.");

        var patchedFileContents = apply_patches(argv["file-to-patch"], argv["patch-config"]);
        //console.log(patchedFileContents);

        if(argv["destination-patched-file"] != null)
        {
            var destination = argv["destination-patched-file"];
            console.log("patching to output file " + destination);
        }
        else
        {
            var destination = argv["file-to-patch"];
            console.log("patching " + destination + " in-place")
        }

		try
		{
			var stats = fs.statSync(destination);

			if (stats.isFile())
			{
                if(argv.overwrite)
				{
                    console.log("File exists, but the --overwrite flag was specified. Overwriting it.");
					try
					{
                        fs.unlinkSync(destination);
						fs.writeFileSync(destination, patchedFileContents);
					}
					catch (e)
					{
						console.log('Error writing patched contents to file : ' + destination, e.code);
					}
				}
				else
				{
					console.error("File exists, so we are not modifying it. Specify the --overwrite to force replacement.");
				}
			}
		}
		catch(e)
		{
			fs.writeFileSync(destination, patchedFileContents);
		}

    }

}
else
{
	print_usage(arguments);
	process.exit(1)
}
