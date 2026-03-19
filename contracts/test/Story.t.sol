// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Story} from "../src/Story.sol";

contract StoryTest is Test {
    Story public story;

    function setUp() public {
        story = new Story();
    }

    function test_AddWord() public {
        bytes memory pubKey = hex"123456";
        story.addWord(1, pubKey);
        Story.Word[] memory words = story.getStory();
        assertEq(words.length, 1);
        assertEq(words[0].index, 1);
        assertEq(words[0].authorPublicKey, pubKey);
    }

    function test_AddMultipleWords() public {
        bytes memory pubKey1 = hex"123456";
        bytes memory pubKey2 = hex"abcdef";
        
        story.addWord(1, pubKey1);
        story.addWord(5, pubKey2);
        
        Story.Word[] memory words = story.getStory();
        assertEq(words.length, 2);
        assertEq(words[0].index, 1);
        assertEq(words[1].index, 5);
        assertEq(words[1].authorPublicKey, pubKey2);
    }
}
