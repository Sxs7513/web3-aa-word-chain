// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Story is Ownable {
    struct Word {
        uint256 index;
        bytes authorPublicKey;
    }

    Word[] public words;

    event WordAdded(uint256 indexed index, bytes authorPublicKey);
    event WordUpdated(uint256 indexed index, bytes newAuthorPublicKey);
    event WordDeleted(uint256 indexed index);

    constructor() Ownable(msg.sender) {}

    function addWord(uint256 index, bytes calldata authorPublicKey) external {
        words.push(Word(index, authorPublicKey));
        emit WordAdded(index, authorPublicKey);
    }

    function addWords(uint256[] calldata indexes, bytes calldata authorPublicKey) external {
        require(indexes.length > 0, "No indexes provided");
        for (uint256 i = 0; i < indexes.length; i++) {
            words.push(Word(indexes[i], authorPublicKey));
            emit WordAdded(indexes[i], authorPublicKey);
        }
    }

    function updateWord(uint256 index, bytes calldata newAuthorPublicKey) external onlyOwner {
        require(index < words.length, "Index out of bounds");
        words[index] = Word(words[index].index, newAuthorPublicKey);
        emit WordUpdated(index, newAuthorPublicKey);
    }

    function deleteWord() external onlyOwner {
        require(words.length > 0, "No words to delete");
        uint256 index = words.length - 1;
        words.pop();
        emit WordDeleted(index);
    }

    function getStory() external view returns (Word[] memory) {
        return words;
    }
}
